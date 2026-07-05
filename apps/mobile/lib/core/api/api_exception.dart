import 'package:dio/dio.dart';

/// Normalised API error. `messageKey` is an easy_localization key so the UI can
/// render a translated message regardless of platform.
class ApiException implements Exception {
  const ApiException({
    required this.messageKey,
    this.statusCode,
    this.serverKey,
  });

  final String messageKey;
  final int? statusCode;

  /// Raw i18n key the backend returned (all backend errors use i18n keys).
  final String? serverKey;

  bool get isUnauthorized => statusCode == 401;
  bool get isNetwork => statusCode == null;

  factory ApiException.fromDio(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return const ApiException(messageKey: 'common.networkError');
    }

    final status = e.response?.statusCode;
    String? serverKey;
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final message = data['message'];
      if (message is String) serverKey = message;
    }

    if (status == 401) {
      return ApiException(
        messageKey: 'auth.sessionExpired',
        statusCode: 401,
        serverKey: serverKey,
      );
    }
    return ApiException(
      messageKey: 'common.unknownError',
      statusCode: status,
      serverKey: serverKey,
    );
  }

  @override
  String toString() =>
      'ApiException(status: $statusCode, key: $messageKey, server: $serverKey)';
}
