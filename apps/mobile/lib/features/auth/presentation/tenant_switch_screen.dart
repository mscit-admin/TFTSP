import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/features/auth/domain/auth_models.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_controller.dart';

/// Lets a multi-tribe member pick the active tribe. Because the JWT is
/// tenant-scoped, confirming a switch re-authenticates against the chosen slug
/// (password re-entered, never stored).
class TenantSwitchScreen extends ConsumerWidget {
  const TenantSwitchScreen({super.key});

  Future<void> _confirm(
    BuildContext context,
    WidgetRef ref,
    TenantMembership target,
  ) async {
    final password = await _askPassword(context);
    if (password == null || password.isEmpty) return;
    await ref
        .read(authControllerProvider.notifier)
        .switchTenant(target: target, password: password);
  }

  Future<String?> _askPassword(BuildContext context) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('tenant.passwordToSwitch'.tr()),
        content: TextField(
          controller: controller,
          obscureText: true,
          decoration: InputDecoration(labelText: 'auth.password'.tr()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('common.cancel'.tr()),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text),
            child: Text('common.ok'.tr()),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authControllerProvider);
    final lang = context.locale.languageCode;
    final activeId = state.activeTenant?.tenantId;

    return Scaffold(
      appBar: AppBar(title: Text('tenant.switchTitle'.tr())),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'tenant.switchHint'.tr(),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          Expanded(
            child: ListView.separated(
              itemCount: state.tenants.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final t = state.tenants[i];
                final isActive = t.tenantId == activeId;
                return ListTile(
                  leading: CircleAvatar(child: Text(t.displayName(lang).characters.first)),
                  title: Text(t.displayName(lang)),
                  subtitle: Text(t.tenantSlug),
                  trailing: isActive
                      ? const Icon(Icons.check_circle, color: Colors.green)
                      : const Icon(Icons.chevron_right),
                  onTap: isActive || state.busy
                      ? null
                      : () => unawaited(_confirm(context, ref, t)),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
