import 'package:flutter/widgets.dart';

/// Localization configuration shared by the app and tests.
class L10n {
  const L10n._();

  static const Locale arabic = Locale('ar');
  static const Locale english = Locale('en');

  static const List<Locale> supportedLocales = [arabic, english];

  static const Locale fallbackLocale = english;

  static const String translationsPath = 'assets/translations';

  /// Whether a locale renders right-to-left. Used to flip the tree painter and
  /// widget directionality instantly on toggle.
  static bool isRtl(Locale locale) => locale.languageCode == 'ar';
}
