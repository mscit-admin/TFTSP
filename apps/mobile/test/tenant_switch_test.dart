import 'package:flutter_test/flutter_test.dart';
import 'package:tftsp_mobile/features/auth/domain/auth_models.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_controller.dart';

TenantMembership _m(String slug, String id) => TenantMembership(
      tenantId: id,
      tenantSlug: slug,
      tenantNameAr: 'قبيلة $slug',
      tenantNameEn: 'Tribe $slug',
      roles: const ['viewer'],
    );

void main() {
  group('AuthController.resolveActiveTenant', () {
    final tenants = [_m('alpha', 't1'), _m('beta', 't2')];

    test('picks the exact slug match', () {
      final active = AuthController.resolveActiveTenant(tenants, 'beta');
      expect(active?.tenantId, 't2');
    });

    test('falls back to first when slug is null', () {
      final active = AuthController.resolveActiveTenant(tenants, null);
      expect(active?.tenantId, 't1');
    });

    test('falls back to first when slug does not match', () {
      final active = AuthController.resolveActiveTenant(tenants, 'gamma');
      expect(active?.tenantId, 't1');
    });

    test('returns null for an empty membership list', () {
      expect(AuthController.resolveActiveTenant(const [], 'alpha'), isNull);
    });
  });

  group('TenantMembership.displayName', () {
    test('returns Arabic name for ar and English otherwise', () {
      final m = _m('alpha', 't1');
      expect(m.displayName('ar'), 'قبيلة alpha');
      expect(m.displayName('en'), 'Tribe alpha');
    });
  });
}
