import 'package:dio/dio.dart';
import 'package:tftsp_mobile/core/api/auth_interceptor.dart';
import 'package:tftsp_mobile/core/auth/token_storage.dart';
import 'package:tftsp_mobile/core/logging/app_logger.dart';

/// Resolved at build time via `--dart-define=API_BASE_URL=...`.
/// Default targets an Android emulator hitting a locally-running backend.
const String kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8080/api/v1',
);

/// Builds the app's configured Dio instance with auth + logging interceptors.
class ApiClient {
  ApiClient({
    required TokenStorage storage,
    required Future<void> Function() onSessionExpired,
    String baseUrl = kApiBaseUrl,
  }) {
    final base = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      contentType: 'application/json',
    );

    dio = Dio(base);

    // Bare client for refresh + retry (no auth interceptor → no recursion).
    final refreshDio = Dio(base);

    dio.interceptors.add(
      AuthInterceptor(
        storage: storage,
        refreshDio: refreshDio,
        onSessionExpired: onSessionExpired,
      ),
    );
    dio.interceptors.add(_redactingLogInterceptor());
  }

  late final Dio dio;

  InterceptorsWrapper _redactingLogInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) {
        appLogger.d('→ ${options.method} ${options.uri.path}');
        handler.next(options);
      },
      onResponse: (response, handler) {
        appLogger.d(
          '← ${response.statusCode} ${response.requestOptions.uri.path}',
        );
        handler.next(response);
      },
      onError: (error, handler) {
        appLogger.w(
          '× ${error.response?.statusCode ?? 'ERR'} '
          '${error.requestOptions.uri.path}',
        );
        handler.next(error);
      },
    );
  }
}
