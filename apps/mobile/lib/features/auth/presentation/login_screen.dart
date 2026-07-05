import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tftsp_mobile/core/widgets/language_toggle.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _tenant = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _tenant.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    await ref.read(authControllerProvider.notifier).login(
          email: _email.text.trim(),
          password: _password.text,
          tenantSlug: _tenant.text.trim().isEmpty ? null : _tenant.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text('auth.loginTitle'.tr()),
        actions: const [LanguageToggle()],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: InputDecoration(
                      labelText: 'auth.email'.tr(),
                      prefixIcon: const Icon(Icons.email_outlined),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'auth.emailRequired'.tr()
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    decoration: InputDecoration(
                      labelText: 'auth.password'.tr(),
                      prefixIcon: const Icon(Icons.lock_outline),
                    ),
                    validator: (v) => (v == null || v.isEmpty)
                        ? 'auth.passwordRequired'.tr()
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _tenant,
                    decoration: InputDecoration(
                      labelText: 'auth.tenantSlugOptional'.tr(),
                      prefixIcon: const Icon(Icons.groups_outlined),
                    ),
                  ),
                  if (state.errorKey != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      state.errorKey!.tr(),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: state.busy ? null : _submit,
                      child: state.busy
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text('auth.signIn'.tr()),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => unawaited(context.push('/view-request')),
                    child: Text('viewRequest.title'.tr()),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
