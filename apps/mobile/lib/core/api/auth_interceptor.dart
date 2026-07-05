import 'dart:async';

import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/endpoints.dart';
import 'package:tftsp_mobile/core/auth/token_storage.dart';
import 'package:tftsp_mobile/core/logging/app_logger.dart';

/// Attaches the bearer access token, performs a single-flight silent refresh on
/// 401, retries the original request, and triggers a clean logout when the
/// refresh token is expired/revoked.
///
/// SECURITY: token values are never written to the logger.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required TokenStorage storage,
    required Dio refreshDio,
    required Future<void> Function() onSessionExpired,
  })  : _storage = storage,
        _refreshDio = refreshDio,
        _onSessionExpired = onSessionExpired;

  final TokenStorage _storage;

  /// A bare Dio (no interceptors) used only to hit `/auth/refresh`, avoiding
  /// recursion into this interceptor.
  final Dio _refreshDio;

  final Future<void> Function() _onSessionExpired;

  /// Single-flight guard so concurrent 401s trigger one refresh.
  Completer<bool>? _refreshing;

  static const _retriedFlag = 'tftsp_retried';

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Never attach tokens to the public auth endpoints.
    if (!_isAuthEndpoint(options.path)) {
      final tokens = await _storage.read();
      if (tokens != null) {
        options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final request = err.requestOptions;

    final shouldRefresh = response?.statusCode == 401 &&
        !_isAuthEndpoint(request.path) &&
        request.extra[_retriedFlag] != true;

    if (!shouldRefresh) {
      handler.next(err);
      return;
    }

    final refreshed = await _refreshTokens();
    if (!refreshed) {
      await _onSessionExpired();
      handler.next(err);
      return;
    }

    try {
      final retried = await _retry(request);
      handler.resolve(retried);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  Future<bool> _refreshTokens() {
    final existing = _refreshing;
    if (existing != null) return existing.future;

    final completer = Completer<bool>();
    _refreshing = completer;

    final pending = _performRefresh().then((ok) {
      _refreshing = null;
      completer.complete(ok);
    }).catchError((Object _) {
      _refreshing = null;
      completer.complete(false);
    });
    unawaited(pending);

    return completer.future;
  }

  Future<bool> _performRefresh() async {
    final tokens = await _storage.read();
    if (tokens == null) return false;
    try {
      final res = await _refreshDio.post<Map<String, dynamic>>(
        Endpoints.refresh,
        data: {'refreshToken': tokens.refreshToken},
      );
      final data = res.data;
      if (data == null) return false;
      final access = data['accessToken'] as String?;
      final refresh = data['refreshToken'] as String?;
      if (access == null || refresh == null) return false;
      await _storage.write(
        AuthTokens(accessToken: access, refreshToken: refresh),
      );
      appLogger.d('Access token refreshed');
      return true;
    } on DioException catch (e) {
      // Reuse/expiry ⇒ backend revokes the chain; treat as terminal.
      appLogger.w('Token refresh failed (status ${e.response?.statusCode})');
      return false;
    }
  }

  Future<Response<dynamic>> _retry(RequestOptions request) async {
    final tokens = await _storage.read();
    final options = Options(
      method: request.method,
      headers: {
        ...request.headers,
        if (tokens != null) 'Authorization': 'Bearer ${tokens.accessToken}',
      },
      extra: {...request.extra, _retriedFlag: true},
    );
    return _refreshDio.request<dynamic>(
      request.path,
      data: request.data,
      queryParameters: request.queryParameters,
      options: options,
    );
  }

  bool _isAuthEndpoint(String path) =>
      path.contains(Endpoints.login) ||
      path.contains(Endpoints.refresh) ||
      path.contains(Endpoints.logout);
}
