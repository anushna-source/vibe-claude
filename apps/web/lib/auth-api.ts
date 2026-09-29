import 'server-only';
import {
  authUserResponseSchema,
  sessionResponseSchema,
  type AuthUser,
  type LoginInput,
  type Session,
  type SignupInput,
} from '@inventory/shared';
import { ApiError } from './api-client';
import { apiBaseUrl } from './env';

/**
 * Server-side calls to the auth endpoints. These cannot go through
 * lib/api-client.ts because they need the API's Set-Cookie header: the refresh
 * token is re-issued as a first-party cookie on this app's own origin, so it is
 * never exposed to browser JavaScript.
 */

const REFRESH_COOKIE = 'inventory_refresh';

export interface AuthResult {
  session: Session;
  /** The raw refresh token, to be stored in this app's own httpOnly cookie. */
  refreshToken: string | null;
}

function readRefreshToken(response: Response): string | null {
  const cookies = response.headers.getSetCookie();

  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    const [name, ...rest] = (pair ?? '').split('=');
    if (name?.trim() === REFRESH_COOKIE) {
      const value = rest.join('=');
      return value.length > 0 ? value : null;
    }
  }

  return null;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);

  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'object'
  ) {
    const error = (body as { error: { code?: unknown; message?: unknown } }).error;
    return new ApiError(
      typeof error.code === 'string' ? (error.code as ApiError['code']) : 'INTERNAL_ERROR',
      typeof error.message === 'string' ? error.message : 'Something went wrong',
      { status: response.status },
    );
  }

  return new ApiError('INTERNAL_ERROR', 'The server returned an unexpected response', {
    status: response.status,
  });
}

async function postSession(
  path: string,
  body?: unknown,
  refreshToken?: string,
): Promise<AuthResult> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl().replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(refreshToken ? { Cookie: `${REFRESH_COOKIE}=${refreshToken}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server');
  }

  if (!response.ok) throw await toApiError(response);

  const payload: unknown = await response.json();
  const parsed = sessionResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError('INTERNAL_ERROR', 'The server returned an unexpected response');
  }

  return { session: parsed.data.data, refreshToken: readRefreshToken(response) };
}

export function signup(input: SignupInput): Promise<AuthResult> {
  return postSession('/auth/signup', input);
}

export function login(input: LoginInput): Promise<AuthResult> {
  return postSession('/auth/login', input);
}

export function refreshSession(refreshToken: string): Promise<AuthResult> {
  return postSession('/auth/refresh', undefined, refreshToken);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;

  try {
    await fetch(`${apiBaseUrl().replace(/\/+$/, '')}/auth/logout`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}` },
    });
  } catch {
    // Signing out locally must succeed even if the API is unreachable.
  }
}

/** Reads the signed-in user. Returns null for any invalid or expired token. */
export async function fetchCurrentUser(accessToken: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${apiBaseUrl().replace(/\/+$/, '')}/auth/me`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return null;

    const parsed = authUserResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.data : null;
  } catch {
    return null;
  }
}
