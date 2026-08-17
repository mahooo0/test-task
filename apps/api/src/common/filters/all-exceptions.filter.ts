import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { ApiError, ApiErrorCode } from '@dataroom/types';
import { AppException } from '../exceptions/app.exception';
import { type ApiLocale, resolveLocale } from '../i18n/locale';
import {
  GENERIC_BY_CODE,
  type MessageParams,
  translate,
} from '../i18n/messages';

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
};

/**
 * Turns any thrown error into the single error envelope `{ data: null, error }`. The `message` is
 * localized to the request's locale (`X-Locale` → `Accept-Language` → default): domain errors carry
 * a stable message key (`AppException`), everything else falls back to a generic message per code.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const locale = resolveLocale(request.headers);
    const { status, error } = this.normalize(exception, locale);

    // 5xx are unexpected — log the stack server-side; the client only ever sees the envelope.
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json({ data: null, error });
  }

  private normalize(
    exception: unknown,
    locale: ApiLocale,
  ): { status: number; error: ApiError } {
    // Domain errors: a stable key + params, localized here (services stay language-agnostic).
    if (exception instanceof AppException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as {
        params?: MessageParams;
        details?: unknown;
      };
      return {
        status,
        error: {
          code: STATUS_TO_CODE[status] ?? 'INTERNAL',
          message: translate(exception.messageKey, locale, body.params),
          details: body.details,
        },
      };
    }

    // Framework HttpExceptions (validation pipe, route-not-found, …): localize a generic message by
    // category and keep the raw field errors in `details` for debugging.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_TO_CODE[status] ?? 'INTERNAL';
      return {
        status,
        error: {
          code,
          message: translate(GENERIC_BY_CODE[code], locale),
          details: this.extractDetails(exception.getResponse()),
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          error: {
            code: 'CONFLICT',
            message: translate('generic.conflict', locale),
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          error: {
            code: 'NOT_FOUND',
            message: translate('generic.notFound', locale),
          },
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: 'INTERNAL',
        message: translate('generic.internal', locale),
      },
    };
  }

  /**
   * Pulls the structured field errors out of a Nest HttpException body so they survive into
   * `details` (class-validator uses `message: string[]`). The human-readable `message` itself is
   * replaced by a localized generic one, so we only keep the structured part.
   */
  private extractDetails(response: string | object): unknown {
    if (typeof response === 'string') {
      return undefined;
    }
    const body = response as { message?: unknown; details?: unknown };
    if (body.details !== undefined) {
      return body.details;
    }
    return Array.isArray(body.message) ? body.message : undefined;
  }
}
