import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:tftsp_mobile/core/l10n/l10n.dart';

/// AppBar action that instantly flips AR ⇄ EN (and thus RTL ⇄ LTR) on every
/// screen, including the tree, by calling [EasyLocalization.setLocale].
class LanguageToggle extends StatelessWidget {
  const LanguageToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final isArabic = context.locale.languageCode == 'ar';
    return IconButton(
      tooltip: 'settings.language'.tr(),
      icon: const Icon(Icons.translate),
      onPressed: () {
        context.setLocale(isArabic ? L10n.english : L10n.arabic);
      },
    );
  }
}
