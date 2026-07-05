import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tftsp_mobile/core/widgets/offline_badge.dart';
import 'package:tftsp_mobile/features/contributions/domain/contribution_models.dart';
import 'package:tftsp_mobile/features/contributions/presentation/contribution_controller.dart';

class MyRequestsScreen extends ConsumerWidget {
  const MyRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myRequestsProvider);
    return Column(
      children: [
        const OfflineBadge(),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'contributions.myRequestsTitle'.tr(),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              TextButton.icon(
                onPressed: () => unawaited(context.push('/reputation')),
                icon: const Icon(Icons.workspace_premium_outlined),
                label: Text('reputation.title'.tr()),
              ),
            ],
          ),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: TextButton(
                onPressed: () => ref.invalidate(myRequestsProvider),
                child: Text('common.retry'.tr()),
              ),
            ),
            data: (items) {
              if (items.isEmpty) {
                return Center(child: Text('common.empty'.tr()));
              }
              return RefreshIndicator(
                onRefresh: () async => ref.invalidate(myRequestsProvider),
                child: ListView.separated(
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) => _RequestTile(items[i]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile(this.request);

  final ChangeRequest request;

  @override
  Widget build(BuildContext context) {
    final type = request.contributionType?.labelKey;
    return ListTile(
      leading: const Icon(Icons.assignment_outlined),
      title: Text(type != null ? type.tr() : request.targetType),
      subtitle: Text(request.createdAt),
      trailing: Chip(label: Text(request.statusKey.tr())),
    );
  }
}
