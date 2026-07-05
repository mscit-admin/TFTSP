import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/features/contributions/domain/contribution_models.dart';
import 'package:tftsp_mobile/features/contributions/presentation/contribution_controller.dart';

/// Create a Change Request (add/edit) with a `contributionType`.
///
/// A single field/value edit is expressed as one RFC-6902 `replace` (edit) or
/// `add` (create) patch op — enough for the member flow; richer editing stays
/// on the web panel.
class CreateChangeRequestScreen extends ConsumerStatefulWidget {
  const CreateChangeRequestScreen({this.personId, super.key});

  /// The person being edited, when launched from a person card.
  final String? personId;

  @override
  ConsumerState<CreateChangeRequestScreen> createState() =>
      _CreateChangeRequestScreenState();
}

class _CreateChangeRequestScreenState
    extends ConsumerState<CreateChangeRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _field = TextEditingController();
  final _value = TextEditingController();

  ContributionType _type = ContributionType.editData;
  String _operation = 'update';

  @override
  void dispose() {
    _field.dispose();
    _value.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    // Writes require a connection (Spec §3·M5.9 — offline is read-only).
    final online = await ref.read(connectivityServiceProvider).isOnline();
    if (!mounted) return;
    if (!online) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('common.writeBlockedOffline'.tr())),
      );
      return;
    }
    final patch = [
      JsonPatchOp(
        op: _operation == 'create' ? 'add' : 'replace',
        path: '/${_field.text.trim()}',
        value: _value.text,
      ),
    ];
    final ok = await ref.read(createRequestControllerProvider.notifier).submit(
          targetType: 'person',
          operation: _operation,
          patch: patch,
          contributionType: _type,
          targetId: _operation == 'update' ? widget.personId : null,
        );
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('contributions.submitted'.tr())),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(createRequestControllerProvider);
    return Scaffold(
      appBar: AppBar(title: Text('contributions.createTitle'.tr())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DropdownButtonFormField<ContributionType>(
                value: _type,
                decoration: InputDecoration(
                  labelText: 'contributions.contributionType'.tr(),
                ),
                items: [
                  for (final t in ContributionType.values)
                    DropdownMenuItem(value: t, child: Text(t.labelKey.tr())),
                ],
                onChanged: (v) => setState(() => _type = v ?? _type),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _operation,
                decoration: InputDecoration(
                  labelText: 'contributions.operation'.tr(),
                ),
                items: [
                  DropdownMenuItem(
                    value: 'update',
                    child: Text('contributions.opUpdate'.tr()),
                  ),
                  DropdownMenuItem(
                    value: 'create',
                    child: Text('contributions.opCreate'.tr()),
                  ),
                ],
                onChanged: (v) => setState(() => _operation = v ?? _operation),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _field,
                decoration: InputDecoration(
                  labelText: 'contributions.field'.tr(),
                  hintText: 'birthPlace',
                ),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'contributions.field'.tr()
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _value,
                decoration: InputDecoration(
                  labelText: 'contributions.newValue'.tr(),
                ),
              ),
              if (state.errorKey != null) ...[
                const SizedBox(height: 16),
                Text(
                  state.errorKey!.tr(),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: state.busy ? null : _submit,
                child: state.busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('contributions.submit'.tr()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
