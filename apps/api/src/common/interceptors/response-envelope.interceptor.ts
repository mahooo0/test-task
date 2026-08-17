import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { ApiSuccess } from '@dataroom/types';

/**
 * Wraps every successful handler return value in the success envelope
 * `{ data, error: null }`. Handlers returning `undefined` (204 No Content,
 * or routes that write the response directly) are passed through untouched.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccess<T> | undefined
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T> | undefined> {
    return next
      .handle()
      .pipe(
        map((data) => (data === undefined ? undefined : { data, error: null })),
      );
  }
}
