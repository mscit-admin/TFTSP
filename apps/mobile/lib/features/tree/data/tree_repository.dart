import 'dart:convert';

import 'package:tftsp_mobile/core/api/api_exception.dart';
import 'package:tftsp_mobile/core/connectivity/connectivity_service.dart';
import 'package:tftsp_mobile/core/db/cache_database.dart';
import 'package:tftsp_mobile/core/logging/app_logger.dart';
import 'package:tftsp_mobile/features/tree/data/tree_api.dart';
import 'package:tftsp_mobile/features/tree/domain/tree_models.dart';

/// Fetches tree data, transparently caching the last result per tenant and
/// serving it when offline.
class TreeRepository {
  TreeRepository({
    required TreeApi api,
    required CacheDatabase cache,
    required ConnectivityService connectivity,
    required String Function() activeTenantId,
  })  : _api = api,
        _cache = cache,
        _connectivity = connectivity,
        _activeTenantId = activeTenantId;

  final TreeApi _api;
  final CacheDatabase _cache;
  final ConnectivityService _connectivity;
  final String Function() _activeTenantId;

  /// Result plus a flag telling the UI whether the payload came from cache.
  Future<({TreeResponse tree, bool fromCache})> load({
    String? rootId,
    int generations = 3,
  }) async {
    final scope = _activeTenantId();
    final key = CacheKeys.tree(rootId, generations);

    final online = await _connectivity.isOnline();
    if (!online) {
      final cached = await _readCache(scope, key);
      if (cached != null) return (tree: cached, fromCache: true);
      throw const ApiException(messageKey: 'common.networkError');
    }

    try {
      final tree = await _api.fetch(rootId: rootId, generations: generations);
      await _cache.put(scope: scope, key: key, jsonValue: jsonEncode(tree));
      return (tree: tree, fromCache: false);
    } on ApiException {
      final cached = await _readCache(scope, key);
      if (cached != null) return (tree: cached, fromCache: true);
      rethrow;
    }
  }

  Future<TreeResponse?> _readCache(String scope, String key) async {
    try {
      final raw = await _cache.get(scope: scope, key: key);
      if (raw == null) return null;
      return TreeResponse.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Object catch (e) {
      appLogger.w('Tree cache read failed: $e');
      return null;
    }
  }
}
