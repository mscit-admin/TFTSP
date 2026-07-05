import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tftsp_mobile/core/widgets/language_toggle.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_controller.dart';
import 'package:tftsp_mobile/features/contributions/presentation/my_requests_screen.dart';
import 'package:tftsp_mobile/features/home/presentation/home_providers.dart';
import 'package:tftsp_mobile/features/notifications/presentation/notification_controller.dart';
import 'package:tftsp_mobile/features/notifications/presentation/notifications_screen.dart';
import 'package:tftsp_mobile/features/tree/presentation/tree_screen.dart';

/// Signed-in shell: family tree / contributions / notifications with a top bar
/// carrying the active tribe, tenant switch, language toggle and logout.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key});

  static const _titleKeys = [
    'tree.title',
    'contributions.myRequestsTitle',
    'notifications.title',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final lang = context.locale.languageCode;
    final unread = ref.watch(unreadCountProvider);
    final index = ref.watch(homeTabProvider);

    const pages = [TreeScreen(), MyRequestsScreen(), NotificationsScreen()];

    return Scaffold(
      appBar: AppBar(
        title: Text(_titleKeys[index].tr()),
        actions: [
          if (auth.isMultiTribe)
            TextButton.icon(
              onPressed: () => unawaited(context.push('/tenant-switch')),
              icon: const Icon(Icons.groups),
              label: Text(
                auth.activeTenant?.displayName(lang) ?? 'tenant.activeTribe'.tr(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          const LanguageToggle(),
          IconButton(
            tooltip: 'auth.signOut'.tr(),
            icon: const Icon(Icons.logout),
            onPressed: () =>
                unawaited(ref.read(authControllerProvider.notifier).logout()),
          ),
        ],
      ),
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) =>
            ref.read(homeTabProvider.notifier).state = i,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.account_tree_outlined),
            selectedIcon: const Icon(Icons.account_tree),
            label: 'tree.title'.tr(),
          ),
          NavigationDestination(
            icon: const Icon(Icons.assignment_outlined),
            selectedIcon: const Icon(Icons.assignment),
            label: 'contributions.myRequestsTitle'.tr(),
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: const Icon(Icons.notifications),
            label: 'notifications.title'.tr(),
          ),
        ],
      ),
    );
  }
}
