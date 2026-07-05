import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/api/api_exception.dart';
import 'package:tftsp_mobile/core/auth/token_storage.dart';
import 'package:tftsp_mobile/core/logging/app_logger.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/features/auth/domain/auth_models.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_state.dart';

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // Kick off a silent restore; state starts as `unknown` (splash).
    unawaited(Future.microtask(_restore));
    return const AuthState();
  }

  TokenStorage get _storage => ref.read(tokenStorageProvider);

  /// Pure helper (unit-tested): choose the active membership after login.
  /// Prefers an exact slug match, else the first membership.
  static TenantMembership? resolveActiveTenant(
    List<TenantMembership> tenants,
    String? requestedSlug,
  ) {
    if (tenants.isEmpty) return null;
    if (requestedSlug != null && requestedSlug.isNotEmpty) {
      for (final t in tenants) {
        if (t.tenantSlug == requestedSlug) return t;
      }
    }
    return tenants.first;
  }

  Future<void> _restore() async {
    final tokens = await _storage.read();
    if (tokens == null) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }
    // We have tokens but no in-memory profile. A protected call will refresh
    // or, on failure, trigger a clean logout via the interceptor. We optim
    // -istically mark authenticated and let the first data call validate.
    state = state.copyWith(status: AuthStatus.authenticated);
    await _loadPrimaryColor();
  }

  Future<void> login({
    required String email,
    required String password,
    String? tenantSlug,
  }) async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final res = await ref.read(authApiProvider).login(
            email: email,
            password: password,
            tenantSlug: tenantSlug,
          );
      await _storage.write(
        AuthTokens(
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        ),
      );
      final active = resolveActiveTenant(res.tenants, tenantSlug);
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: res.user,
        tenants: res.tenants,
        activeTenant: active,
        busy: false,
        clearError: true,
      );
      await _loadPrimaryColor();
      await ref.read(pushServiceProvider).registerForCurrentUser();
    } on DioException catch (e) {
      state = state.copyWith(busy: false, errorKey: _mapLoginError(e));
    } on Object catch (e) {
      appLogger.w('Login failed: $e');
      state = state.copyWith(busy: false, errorKey: 'common.unknownError');
    }
  }

  /// Switch the active tribe. The JWT is tenant-scoped, so switching means a
  /// fresh authentication against the chosen slug; the password is re-entered
  /// (never persisted). The previous tribe's offline cache is purged so no
  /// inactive-tribe data can surface.
  Future<void> switchTenant({
    required TenantMembership target,
    required String password,
  }) async {
    final email = state.user?.email;
    if (email == null) return;
    final previousTenantId = state.activeTenant?.tenantId;

    state = state.copyWith(busy: true, clearError: true);
    try {
      final res = await ref.read(authApiProvider).login(
            email: email,
            password: password,
            tenantSlug: target.tenantSlug,
          );
      await _storage.write(
        AuthTokens(
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        ),
      );
      if (previousTenantId != null && previousTenantId != target.tenantId) {
        await ref.read(cacheDatabaseProvider).clearScope(previousTenantId);
      }
      final active =
          resolveActiveTenant(res.tenants, target.tenantSlug) ?? target;
      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: res.user,
        tenants: res.tenants,
        activeTenant: active,
        busy: false,
        clearError: true,
      );
      await _loadPrimaryColor();
      await ref.read(pushServiceProvider).registerForCurrentUser();
    } on DioException catch (e) {
      state = state.copyWith(busy: false, errorKey: _mapLoginError(e));
    }
  }

  Future<void> logout() async {
    final tokens = await _storage.read();
    // Deregister push + best-effort server logout; never block on failure.
    await ref.read(pushServiceProvider).deregister();
    if (tokens != null) {
      try {
        await ref.read(authApiProvider).logout(tokens.refreshToken);
      } on Object catch (e) {
        appLogger.d('Server logout ignored: $e');
      }
    }
    await _clearSession();
  }

  /// Called by the interceptor when a refresh is rejected (expired/revoked):
  /// clean logout to the login screen, no crash.
  Future<void> handleSessionExpired() async {
    appLogger.w('Session expired — signing out');
    await _clearSession();
  }

  Future<void> _clearSession() async {
    final tenantId = state.activeTenant?.tenantId;
    await _storage.clear();
    if (tenantId != null) {
      await ref.read(cacheDatabaseProvider).clearScope(tenantId);
    }
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Fetch the active tribe's primary colour for theming. Best-effort.
  Future<void> _loadPrimaryColor() async {
    try {
      final res = await ref
          .read(dioProvider)
          .get<Map<String, dynamic>>('/tenant/settings');
      final color = res.data?['primaryColor'] as String?;
      if (color != null) state = state.copyWith(primaryColorHex: color);
    } on Object catch (e) {
      appLogger.d('Tenant primary colour unavailable: $e');
    }
  }

  String _mapLoginError(DioException e) {
    final status = e.response?.statusCode;
    if (status == 401) return 'auth.invalidCredentials';
    if (status == 423 || status == 429) return 'auth.accountLocked';
    return ApiException.fromDio(e).messageKey;
  }
}
