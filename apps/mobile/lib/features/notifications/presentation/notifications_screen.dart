import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/widgets/offline_badge.dart';
import 'package:tftsp_mobile/features/home/presentation/home_providers.dart';
import 'package:tftsp_mobile/features/notifications/domain/notification_models.dart';
import 'package:tftsp_mobile/features/notifications/presentation/notification_controller.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  void _open(WidgetRef ref, AppNotification n) {
    if (n.isUnread) {
      // Fire-and-forget mark-read; list refreshes on return.
      unawaited(ref.read(notificationActionsProvider).markRead(n.id));
    }
    // Change-request notifications open the "My requests" tab.
    if (n.changeRequestId != null) {
      ref.read(homeTabProvider.notifier).state = 1;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    return Column(
      children: [
        const OfflineBadge(),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'notifications.title'.tr(),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              TextButton(
                onPressed: () => unawaited(
                  ref.read(notificationActionsProvider).markAllRead(),
                ),
                child: Text('notifications.markAllRead'.tr()),
              ),
            ],
          ),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: TextButton(
                onPressed: () => ref.invalidate(notificationsProvider),
                child: Text('common.retry'.tr()),
              ),
            ),
            data: (res) {
              if (res.data.isEmpty) {
                return Center(child: Text('notifications.empty'.tr()));
              }
              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(notificationsProvider),
                child: ListView.separated(
                  itemCount: res.data.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final n = res.data[i];
                    return ListTile(
                      leading: Icon(
                        n.isUnread
                            ? Icons.notifications_active
                            : Icons.notifications_none,
                        color: n.isUnread
                            ? Theme.of(context).colorScheme.primary
                            : null,
                      ),
                      title: Text(n.messageKey.tr()),
                      subtitle: Text(n.createdAt),
                      onTap: () => _open(ref, n),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
