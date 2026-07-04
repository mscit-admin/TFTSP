import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorKey } from './error-keys';

/**
 * Domain exception carrying an i18n message key (never a hard-coded string) and
 * optional structured details. The exception filter localises and serialises it
 * to `{ statusCode, messageKey, details? }`.
 */
export class AppException extends HttpException {
  constructor(
    public readonly messageKey: ErrorKey,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ messageKey, details }, status);
  }

  static badRequest(key: ErrorKey, details?: Record<string, unknown>): AppException {
    return new AppException(key, HttpStatus.BAD_REQUEST, details);
  }

  static unauthorized(key: ErrorKey, details?: Record<string, unknown>): AppException {
    return new AppException(key, HttpStatus.UNAUTHORIZED, details);
  }

  static forbidden(key: ErrorKey, details?: Record<string, unknown>): AppException {
    return new AppException(key, HttpStatus.FORBIDDEN, details);
  }

  static notFound(key: ErrorKey, details?: Record<string, unknown>): AppException {
    return new AppException(key, HttpStatus.NOT_FOUND, details);
  }

  static conflict(key: ErrorKey, details?: Record<string, unknown>): AppException {
    return new AppException(key, HttpStatus.CONFLICT, details);
  }
}
