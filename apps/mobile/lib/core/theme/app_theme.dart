import 'package:flutter/material.dart';

/// Builds light/dark themes seeded from the active tribe's primary colour.
class AppTheme {
  const AppTheme._();

  static const Color fallbackSeed = Color(0xFF2E7D32);

  /// Parses a `#RRGGBB` / `RRGGBB` / `#AARRGGBB` string into a [Color].
  /// Returns [fallbackSeed] when the value is null or malformed.
  static Color parseColor(String? hex) {
    if (hex == null) return fallbackSeed;
    var value = hex.trim().replaceFirst('#', '');
    if (value.length == 6) value = 'FF$value';
    if (value.length != 8) return fallbackSeed;
    final parsed = int.tryParse(value, radix: 16);
    if (parsed == null) return fallbackSeed;
    return Color(parsed);
  }

  static ThemeData light(String? primaryHex) {
    final seed = parseColor(primaryHex);
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: seed),
      appBarTheme: const AppBarTheme(centerTitle: true),
    );
  }

  static ThemeData dark(String? primaryHex) {
    final seed = parseColor(primaryHex);
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seed,
        brightness: Brightness.dark,
      ),
      appBarTheme: const AppBarTheme(centerTitle: true),
    );
  }
}
