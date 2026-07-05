import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/features/contributions/presentation/contribution_controller.dart';

class ReputationScreen extends ConsumerWidget {
  const ReputationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myReputationProvider);
    return Scaffold(
      appBar: AppBar(title: Text('reputation.title'.tr())),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: TextButton(
            onPressed: () => ref.invalidate(myReputationProvider),
            child: Text('common.retry'.tr()),
          ),
        ),
        data: (rep) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Center(
              child: Chip(
                avatar: const Icon(Icons.workspace_premium, size: 18),
                label: Text(rep.trustLevelKey.tr()),
              ),
            ),
            const SizedBox(height: 16),
            _row(
              'reputation.totalContributions',
              '${rep.totalContributions}',
            ),
            _row('reputation.accepted', '${rep.accepted}'),
            _row('reputation.rejected', '${rep.rejected}'),
            _row(
              'reputation.accuracy',
              '${(rep.accuracyRate * 100).toStringAsFixed(0)}%',
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String labelKey, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(labelKey.tr()),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      );
}
