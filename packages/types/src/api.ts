/** Machine-readable error codes returned in every error response. */
export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  /** Optional structured extra context, e.g. `{ suggestedName }` on a name conflict. */
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiFailure {
  data: null;
  error: ApiError;
}

/** Every JSON response from the API is one of these two shapes. */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
