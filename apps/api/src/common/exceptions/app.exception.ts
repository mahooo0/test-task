import { HttpException } from '@nestjs/common';
import {
  MESSAGES,
  type MessageKey,
  type MessageParams,
} from '../i18n/messages';

/** The body an {@link AppException} carries; the exception filter reads it to localize the response. */
export interface AppExceptionBody {
  messageKey: MessageKey;
  params?: MessageParams;
  details?: unknown;
}

/**
 * A domain error identified by a stable {@link MessageKey}. Its HTTP status comes from the message
 * catalog, and the human-readable text is resolved *per request locale* by the exception filter — so
 * services never hard-code a language. Pass dynamic bits as `params` (for the catalog's ICU
 * `{placeholders}`) and any structured extra as `details` (e.g. `{ suggestedName }` on a conflict).
 */
export class AppException extends HttpException {
  constructor(
    readonly messageKey: MessageKey,
    options: { params?: MessageParams; details?: unknown } = {},
  ) {
    super(
      {
        messageKey,
        params: options.params,
        details: options.details,
      } satisfies AppExceptionBody,
      MESSAGES[messageKey].status,
    );
  }
}
