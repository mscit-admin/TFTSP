import 'package:flutter_test/flutter_test.dart';
import 'package:tftsp_mobile/core/auth/token_storage.dart';

void main() {
  group('InMemoryTokenStorage', () {
    test('returns null before anything is written', () async {
      final storage = InMemoryTokenStorage();
      expect(await storage.read(), isNull);
    });

    test('round-trips written tokens', () async {
      final storage = InMemoryTokenStorage();
      await storage.write(
        const AuthTokens(accessToken: 'a.b.c', refreshToken: 'r.e.f'),
      );
      final read = await storage.read();
      expect(read, isNotNull);
      expect(read!.accessToken, 'a.b.c');
      expect(read.refreshToken, 'r.e.f');
    });

    test('clear removes tokens (clean logout)', () async {
      final storage = InMemoryTokenStorage();
      await storage.write(
        const AuthTokens(accessToken: 'a', refreshToken: 'r'),
      );
      await storage.clear();
      expect(await storage.read(), isNull);
    });
  });
}
