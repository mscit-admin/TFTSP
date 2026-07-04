import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext } from 'nestjs-i18n';
import { ErrorKeys } from './error-keys';

interface ErrorBody {
  statusCode: number;
  messageKey: string;
  details?: unknown;
}

/**
 * Serialises every error to the frozen contract shape:
 * `{ statusCode, messageKey, details? }` with the message key localised via
 * nestjs-i18n against the request locale (Spec §11.3 + API contract).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const i18n = I18nContext.current(host);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let messageKey: string = ErrorKeys.INTERNAL;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (typeof obj.messageKey === 'string') {
          messageKey = obj.messageKey;
          details = obj.details;
        } else if (Array.isArray(obj.message)) {
          // class-validator produced an array of constraint messages.
          messageKey = ErrorKeys.VALIDATION_FAILED;
          details = { errors: obj.message };
        } else if (status === HttpStatus.NOT_FOUND) {
          messageKey = ErrorKeys.NOT_FOUND;
        } else if (status === HttpStatus.UNAUTHORIZED) {
          messageKey = ErrorKeys.UNAUTHORIZED;
        } else if (status === HttpStatus.FORBIDDEN) {
          messageKey = ErrorKeys.FORBIDDEN;
        } else if (typeof obj.message === 'string') {
          details = { message: obj.message };
        }
      }
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    let localizedMessage = messageKey;
    try {
      if (i18n) {
        localizedMessage = i18n.t(messageKey, { defaultValue: messageKey });
      }
    } catch {
      localizedMessage = messageKey;
    }

    const body: ErrorBody & { message: string } = {
      statusCode: status,
      messageKey,
      message: localizedMessage,
      ...(details !== undefined ? { details } : {}),
    };

    response.status(status).json(body);
  }
}
