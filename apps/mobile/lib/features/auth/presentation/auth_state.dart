import 'package:tftsp_mobile/features/auth/domain/auth_models.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// Immutable session state driven by `AuthController`.
class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.tenants = const [],
    this.activeTenant,
    this.primaryColorHex,
    this.busy = false,
    this.errorKey,
  });

  final AuthStatus status;
  final AuthUser? user;
  final List<TenantMembership> tenants;
  final TenantMembership? activeTenant;

  /// Active tribe's primary colour (theme seed); null until settings load.
  final String? primaryColorHex;

  final bool busy;

  /// easy_localization key for the last error, or null.
  final String? errorKey;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isMultiTribe => tenants.length > 1;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    List<TenantMembership>? tenants,
    TenantMembership? activeTenant,
    String? primaryColorHex,
    bool? busy,
    String? errorKey,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      tenants: tenants ?? this.tenants,
      activeTenant: activeTenant ?? this.activeTenant,
      primaryColorHex: primaryColorHex ?? this.primaryColorHex,
      busy: busy ?? this.busy,
      errorKey: clearError ? null : (errorKey ?? this.errorKey),
    );
  }
}
