import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/features/notifications/domain/notification_models.dart';

final notificationsProvider =
    FutureProvider.autoDispose<NotificationListResponse>((ref) async {
  ref.watch(activeTenantIdProvider);
  return ref.watch(notificationApiProvider).list();
});

/// Unread count for a badge on the notifications tab.
final unreadCountProvider = Provider.autoDispose<int>((ref) {
  return ref.watch(notificationsProvider).valueOrNull?.unread ?? 0;
});

final notificationActionsProvider =
    Provider<NotificationActions>(NotificationActions.new);

class NotificationActions {
  NotificationActions(this._ref);

  final Ref _ref;

  Future<void> markRead(String id) async {
    await _ref.read(notificationApiProvider).markRead(id);
    _ref.invalidate(notificationsProvider);
  }

  Future<void> markAllRead() async {
    await _ref.read(notificationApiProvider).markAllRead();
    _ref.invalidate(notificationsProvider);
  }
}
