import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/widgets/language_toggle.dart';
import 'package:tftsp_mobile/features/view_request/domain/view_request_models.dart';
import 'package:tftsp_mobile/features/view_request/presentation/view_request_controller.dart';

/// Public (non-member) tree-view request. No auth required.
class ViewRequestScreen extends ConsumerStatefulWidget {
  const ViewRequestScreen({super.key});

  @override
  ConsumerState<ViewRequestScreen> createState() => _ViewRequestScreenState();
}

class _ViewRequestScreenState extends ConsumerState<ViewRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _tenant = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _branch = TextEditingController();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _tenant.dispose();
    _name.dispose();
    _phone.dispose();
    _branch.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    await ref.read(viewRequestControllerProvider.notifier).submit(
          CreateViewRequest(
            tenantSlug: _tenant.text.trim(),
            fullName: _name.text.trim(),
            phone: _phone.text.trim(),
            reason: _reason.text.trim(),
            allegedBranch: _branch.text.trim(),
          ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(viewRequestControllerProvider);
    ref.listen(viewRequestControllerProvider, (prev, next) {
      if (next.done) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('viewRequest.submitted'.tr())),
        );
        unawaited(Navigator.of(context).maybePop());
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Text('viewRequest.title'.tr()),
        actions: const [LanguageToggle()],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('viewRequest.intro'.tr()),
              const SizedBox(height: 16),
              TextFormField(
                controller: _tenant,
                decoration: InputDecoration(
                  labelText: 'auth.tenantSlugOptional'.tr(),
                ),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'auth.tenantSlugOptional'.tr()
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _name,
                decoration: InputDecoration(
                  labelText: 'viewRequest.fullName'.tr(),
                ),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'viewRequest.nameRequired'.tr()
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration:
                    InputDecoration(labelText: 'viewRequest.phone'.tr()),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'viewRequest.phoneRequired'.tr()
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _branch,
                decoration: InputDecoration(
                  labelText: 'viewRequest.allegedBranch'.tr(),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _reason,
                maxLines: 3,
                decoration:
                    InputDecoration(labelText: 'viewRequest.reason'.tr()),
                validator: (v) => (v == null || v.trim().isEmpty)
                    ? 'viewRequest.reasonRequired'.tr()
                    : null,
              ),
              if (state.errorKey != null) ...[
                const SizedBox(height: 12),
                Text(
                  state.errorKey!.tr(),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: state.busy ? null : _submit,
                child: state.busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('viewRequest.submit'.tr()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
