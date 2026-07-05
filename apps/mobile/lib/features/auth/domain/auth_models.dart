/// Auth domain models — mirror `packages/shared-types/src/auth.ts`.
library;

/// Roles as returned by the backend (see `roles.ts`). Kept as strings to
/// tolerate future additions without breaking the app.
typedef Role = String;

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.isSuperAdmin,
  });

  final String id;
  final String email;
  final String fullName;
  final bool isSuperAdmin;

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String,
        fullName: json['fullName'] as String,
        isSuperAdmin: json['isSuperAdmin'] as bool? ?? false,
      );
}

class TenantMembership {
  const TenantMembership({
    required this.tenantId,
    required this.tenantSlug,
    required this.tenantNameAr,
    required this.tenantNameEn,
    required this.roles,
  });

  final String tenantId;
  final String tenantSlug;
  final String tenantNameAr;
  final String tenantNameEn;
  final List<Role> roles;

  factory TenantMembership.fromJson(Map<String, dynamic> json) =>
      TenantMembership(
        tenantId: json['tenantId'] as String,
        tenantSlug: json['tenantSlug'] as String,
        tenantNameAr: json['tenantNameAr'] as String,
        tenantNameEn: json['tenantNameEn'] as String,
        roles: (json['roles'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
      );

  /// Localised display name for a given language code.
  String displayName(String languageCode) =>
      languageCode == 'ar' ? tenantNameAr : tenantNameEn;
}

class LoginResponse {
  const LoginResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    required this.tenants,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
  final List<TenantMembership> tenants;

  factory LoginResponse.fromJson(Map<String, dynamic> json) => LoginResponse(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
        tenants: (json['tenants'] as List<dynamic>? ?? const [])
            .map((e) => TenantMembership.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
