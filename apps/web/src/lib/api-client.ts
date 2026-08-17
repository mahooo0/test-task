import type { ApiResponse } from '@dataroom/types';
import { env } from '@/config/env';
import { DEFAULT_LOCALE, LOCALE_COOKIE, toLocale } from '@/i18n/config';

/** The active UI locale from the `locale` cookie — sent as `X-Locale` so the API localizes messages. */
function currentLocale(): string {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  return toLocale(match ? decodeURIComponent(match[1]) : null) ?? DEFAULT_LOCALE;
}

/** Thrown on any non-2xx / error-envelope response from the API. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Clerk session token; attached as `Authorization: Bearer` when present. */
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'X-Locale': currentLocale(),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !json || json.error) {
    const error = json?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? response.statusText,
      error?.details,
    );
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body, token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body, token }),
  del: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: 'DELETE', token }),
};
