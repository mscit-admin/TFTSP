import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/api/api_client.dart';
import 'package:tftsp_mobile/core/auth/token_storage.dart';
import 'package:tftsp_mobile/core/connectivity/connectivity_service.dart';
import 'package:tftsp_mobile/core/db/cache_database.dart';
import 'package:tftsp_mobile/features/auth/data/auth_api.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_controller.dart';
import 'package:tftsp_mobile/features/contributions/data/contribution_api.dart';
import 'package:tftsp_mobile/features/notifications/data/device_api.dart';
import 'package:tftsp_mobile/features/notifications/data/notification_api.dart';
import 'package:tftsp_mobile/features/notifications/fcm/push_service.dart';
import 'package:tftsp_mobile/features/person/data/person_api.dart';
import 'package:tftsp_mobile/features/person/data/person_repository.dart';
import 'package:tftsp_mobile/features/tree/data/tree_api.dart';
import 'package:tftsp_mobile/features/tree/data/tree_repository.dart';
import 'package:tftsp_mobile/features/view_request/data/view_request_api.dart';

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return SecureTokenStorage();
});

final connectivityServiceProvider = Provider<ConnectivityService>((ref) {
  return ConnectivityService();
});

/// Live online/offline stream for the offline badge + write gating.
final connectivityStreamProvider = StreamProvider<bool>((ref) {
  return ref.watch(connectivityServiceProvider).onStatusChange;
});

final cacheDatabaseProvider = Provider<CacheDatabase>((ref) {
  final db = CacheDatabase();
  ref.onDispose(db.close);
  return db;
});

/// The configured Dio. Its auth interceptor calls back into [AuthController]
/// when a refresh fails so the app performs a clean logout.
final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  return ApiClient(
    storage: storage,
    onSessionExpired: () async {
      await ref.read(authControllerProvider.notifier).handleSessionExpired();
    },
  );
});

final dioProvider = Provider<Dio>((ref) => ref.watch(apiClientProvider).dio);

// ---------------------------------------------------------------------------
// APIs
// ---------------------------------------------------------------------------

final authApiProvider =
    Provider<AuthApi>((ref) => AuthApi(ref.watch(dioProvider)));

final treeApiProvider =
    Provider<TreeApi>((ref) => TreeApi(ref.watch(dioProvider)));

final personApiProvider =
    Provider<PersonApi>((ref) => PersonApi(ref.watch(dioProvider)));

final contributionApiProvider =
    Provider<ContributionApi>((ref) => ContributionApi(ref.watch(dioProvider)));

final notificationApiProvider =
    Provider<NotificationApi>((ref) => NotificationApi(ref.watch(dioProvider)));

final deviceApiProvider =
    Provider<DeviceApi>((ref) => DeviceApi(ref.watch(dioProvider)));

final viewRequestApiProvider =
    Provider<ViewRequestApi>((ref) => ViewRequestApi(ref.watch(dioProvider)));

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(ref.watch(deviceApiProvider));
});

// ---------------------------------------------------------------------------
// Active tenant — the switch that scopes everything below it.
// ---------------------------------------------------------------------------

/// The active tenant id, or '' when signed out. Repositories key their cache on
/// this and data providers watch it, so switching tribes refetches everything
/// and never surfaces the inactive tribe's data.
final activeTenantIdProvider = Provider<String>((ref) {
  return ref.watch(authControllerProvider).activeTenant?.tenantId ?? '';
});

// ---------------------------------------------------------------------------
// Repositories (cache-aware)
// ---------------------------------------------------------------------------

final treeRepositoryProvider = Provider<TreeRepository>((ref) {
  return TreeRepository(
    api: ref.watch(treeApiProvider),
    cache: ref.watch(cacheDatabaseProvider),
    connectivity: ref.watch(connectivityServiceProvider),
    activeTenantId: () => ref.read(activeTenantIdProvider),
  );
});

final personRepositoryProvider = Provider<PersonRepository>((ref) {
  return PersonRepository(
    api: ref.watch(personApiProvider),
    cache: ref.watch(cacheDatabaseProvider),
    connectivity: ref.watch(connectivityServiceProvider),
    activeTenantId: () => ref.read(activeTenantIdProvider),
  );
});
