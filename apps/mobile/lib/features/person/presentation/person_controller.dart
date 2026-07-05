import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/features/person/data/person_repository.dart';

/// Loads a person card (details + documents + lineage), cache-aware.
final personCardProvider =
    FutureProvider.autoDispose.family<PersonCard, String>((ref, id) async {
  // Re-fetch when the active tribe changes.
  ref.watch(activeTenantIdProvider);
  return ref.watch(personRepositoryProvider).loadCard(id);
});
