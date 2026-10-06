import {
  errorResponseSchema,
  paginationMetaSchema,
  type ErrorCode,
  type PaginationMeta,
} from '@inventory/shared';
import { z, type ZodType } from 'zod';
import { apiBaseUrl, apiTimeoutMs } from './env';

/**
 * The only place the app talks to the API (AGENTS.md: no raw fetch in components).
 * Unwraps the `{ data }` envelope and turns `{ error }` into a typed ApiError,
 * mirroring apps/api/src/lib/app-error.ts.
 */

export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { status?: number; details?: unknown; requestId?: string } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = options.status ?? 0;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Validates the whole response body, so a contract drift fails loudly. */
  schema?: ZodType<{ data: T }>;
  signal?: AbortSignal;
  /** Forwarded as X-Request-Id so a page load can be traced in the API logs. */
  requestId?: string;
  /** Bearer token for a protected endpoint. Read from the session cookie server side. */
  accessToken?: string;
  headers?: Record<string, string>;
}

function buildUrl(path: string): string {
  const base = apiBaseUrl().replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function toFailure(response: Response, body: unknown): ApiError {
  const parsed = errorResponseSchema.safeParse(body);

  if (parsed.success) {
    const { code, message, details, requestId } = parsed.data.error;
    return new ApiError(code, message, { status: response.status, details, requestId });
  }

  // A proxy, gateway or crash returned something that is not our envelope.
  // Never surface the raw body; it may contain internals.
  return new ApiError('INTERNAL_ERROR', 'The server returned an unexpected response', {
    status: response.status,
  });
}

interface RawResponse {
  response: Response;
  payload: unknown;
}

async function send(path: string, options: RequestOptions<unknown>): Promise<RawResponse> {
  const { method = 'GET', body, signal, requestId, accessToken, headers = {} } = options;

  const timeout = AbortSignal.timeout(apiTimeoutMs());
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      signal: combined,
      // Always hit the API; freshness matters more than caching for inventory data.
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(requestId === undefined ? {} : { 'X-Request-Id': requestId }),
        ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    if (timeout.aborted) {
      throw new ApiError('TIMEOUT', 'The server took too long to respond');
    }
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server');
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw toFailure(response, payload);
  }

  return { response, payload };
}

const unexpected = (status: number): ApiError =>
  new ApiError('INTERNAL_ERROR', 'The server returned an unexpected response', { status });

/** Single resources: `{ data }`. */
export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { schema } = options;
  const { response, payload } = await send(path, options);

  // A delete answers 204 with no body; there is no envelope to unwrap.
  if (response.status === 204) {
    return undefined as T;
  }

  if (schema) {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw unexpected(response.status);
    return parsed.data.data;
  }

  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw unexpected(response.status);
  }

  return (payload as { data: T }).data;
}

export interface ApiListResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * List endpoints answer `{ data, meta }` at the top level, not a `data` wrapped
 * around both (AGENTS.md). Keeping that in one place stops every list page from
 * guessing at the envelope.
 */
export async function apiListRequest<T>(
  path: string,
  options: Omit<RequestOptions<T>, 'schema'> & { itemSchema: ZodType<T> },
): Promise<ApiListResult<T>> {
  const { itemSchema, ...rest } = options;
  const { response, payload } = await send(path, rest);

  const parsed = z
    .object({ data: z.array(itemSchema), meta: paginationMetaSchema })
    .safeParse(payload);

  if (!parsed.success) throw unexpected(response.status);

  return parsed.data;
}
