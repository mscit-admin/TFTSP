import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Flatten a nested translation map into dotted keys (e.g. `auth.email`).
Set<String> _flatten(Map<String, dynamic> map, [String prefix = '']) {
  final keys = <String>{};
  map.forEach((k, v) {
    final full = prefix.isEmpty ? k : '$prefix.$k';
    if (v is Map<String, dynamic>) {
      keys.addAll(_flatten(v, full));
    } else {
      keys.add(full);
    }
  });
  return keys;
}

Map<String, dynamic> _load(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  group('translations', () {
    final en = _flatten(_load('assets/translations/en.json'));
    final ar = _flatten(_load('assets/translations/ar.json'));

    test('en and ar have identical key sets', () {
      final missingInAr = en.difference(ar);
      final missingInEn = ar.difference(en);
      expect(missingInAr, isEmpty, reason: 'Missing in ar: $missingInAr');
      expect(missingInEn, isEmpty, reason: 'Missing in en: $missingInEn');
    });

    test('required keys used across screens exist', () {
      const required = [
        'app.title',
        'auth.signIn',
        'auth.sessionExpired',
        'tenant.switchTitle',
        'tree.title',
        'tree.searchHint',
        'person.lineage',
        'contributions.createTitle',
        'contributions.contributionType',
        'reputation.title',
        'viewRequest.title',
        'notifications.title',
        'common.offlineBadge',
        'common.writeBlockedOffline',
      ];
      for (final key in required) {
        expect(en.contains(key), isTrue, reason: 'en missing $key');
        expect(ar.contains(key), isTrue, reason: 'ar missing $key');
      }
    });
  });
}
