import 'package:logger/logger.dart';

/// Application-wide logger.
///
/// SECURITY: never pass access/refresh tokens or full auth headers to this
/// logger. Interceptors redact the `Authorization` header before logging.
final Logger appLogger = Logger(
  printer: PrettyPrinter(
    methodCount: 0,
    errorMethodCount: 5,
    lineLength: 80,
  ),
  // Silence in release builds; framework strips this in production anyway.
  level: Level.debug,
);
