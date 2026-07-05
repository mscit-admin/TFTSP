import 'dart:convert';

import 'package:tftsp_mobile/core/api/api_exception.dart';
import 'package:tftsp_mobile/core/connectivity/connectivity_service.dart';
import 'package:tftsp_mobile/core/db/cache_database.dart';
import 'package:tftsp_mobile/core/logging/app_logger.dart';
import 'package:tftsp_mobile/features/person/data/person_api.dart';
import 'package:tftsp_mobile/features/person/domain/person_models.dart';

/// Card payload: the person plus any opened documents/lineage, with a cache
/// flag for the offline badge.
class PersonCard {
  const PersonCard({
    required this.person,
    required this.documents,
    required this.lineage,
    required this.fromCache,
  });

  final Person person;
  final List<PersonDocument> documents;
  final List<LineageEntry> lineage;
  final bool fromCache;
}

class PersonRepository {
  PersonRepository({
    required PersonApi api,
    required CacheDatabase cache,
    required ConnectivityService connectivity,
    required String Function() activeTenantId,
  })  : _api = api,
        _cache = cache,
        _connectivity = connectivity,
        _activeTenantId = activeTenantId;

  final PersonApi _api;
  final CacheDatabase _cache;
  final ConnectivityService _connectivity;
  final String Function() _activeTenantId;

  Future<PersonCard> loadCard(String id) async {
    final scope = _activeTenantId();
    final key = CacheKeys.person(id);
    final online = await _connectivity.isOnline();

    if (!online) {
      final cached = await _readCache(scope, key);
      if (cached != null) return cached;
      throw const ApiException(messageKey: 'common.networkError');
    }

    try {
      final person = await _api.fetch(id);
      // Documents + lineage are best-effort; absence must not fail the card.
      final documents = await _safeDocuments(id);
      final lineage = await _safeAncestors(id);
      final card = PersonCard(
        person: person,
        documents: documents,
        lineage: lineage,
        fromCache: false,
      );
      await _cache.put(
        scope: scope,
        key: key,
        jsonValue: jsonEncode(_encode(card)),
      );
      return card;
    } on ApiException {
      final cached = await _readCache(scope, key);
      if (cached != null) return cached;
      rethrow;
    }
  }

  Future<List<PersonDocument>> _safeDocuments(String id) async {
    try {
      return await _api.documents(id);
    } on Object catch (e) {
      appLogger.d('Documents unavailable for $id: $e');
      return const [];
    }
  }

  Future<List<LineageEntry>> _safeAncestors(String id) async {
    try {
      return await _api.ancestors(id);
    } on Object catch (e) {
      appLogger.d('Lineage unavailable for $id: $e');
      return const [];
    }
  }

  Map<String, dynamic> _encode(PersonCard card) => {
        'person': _personToJson(card.person),
        'documents': card.documents
            .map((d) => {
                  'id': d.id,
                  'kind': d.kind,
                  'filename': d.filename,
                  'downloadUrl': d.downloadUrl,
                  'sizeBytes': d.sizeBytes,
                })
            .toList(),
        'lineage': card.lineage
            .map((l) => {'id': l.id, 'name': l.name})
            .toList(),
      };

  Map<String, dynamic> _personToJson(Person p) => {
        'id': p.id,
        'fullName': p.fullName,
        'gender': p.gender,
        'isDeceased': p.isDeceased,
        'firstName': p.firstName,
        'fatherName': p.fatherName,
        'grandfatherName': p.grandfatherName,
        'familyName': p.familyName,
        'laqab': p.laqab,
        'birthDate': p.birthDate,
        'birthPlace': p.birthPlace,
        'deathDate': p.deathDate,
        'deathPlace': p.deathPlace,
        'fatherId': p.fatherId,
        'motherId': p.motherId,
        'tribalUnitId': p.tribalUnitId,
        'profession': p.profession,
        'photoUrl': p.photoUrl,
        'biography': p.biography,
        'version': p.version,
      };

  Future<PersonCard?> _readCache(String scope, String key) async {
    try {
      final raw = await _cache.get(scope: scope, key: key);
      if (raw == null) return null;
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return PersonCard(
        person: Person.fromJson(map['person'] as Map<String, dynamic>),
        documents: (map['documents'] as List<dynamic>? ?? const [])
            .map((e) => PersonDocument.fromJson(e as Map<String, dynamic>))
            .toList(),
        lineage: (map['lineage'] as List<dynamic>? ?? const [])
            .map((e) => LineageEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        fromCache: true,
      );
    } on Object catch (e) {
      appLogger.w('Person cache read failed: $e');
      return null;
    }
  }
}
