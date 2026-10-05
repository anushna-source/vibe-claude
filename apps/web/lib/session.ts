import 'server-only';
import type { AuthUser, Session } from '@inventory/shared';
import { cookies } from 'next/headers';
import { fetchCurrentUser } from './auth-api';

/**
 * Both tokens live in httpOnly cookies on this app's own origin, so no page
 * script can read them. The access token is short-lived; middleware.ts renews
 * it from the refresh cookie.
 */

export const ACCESS_COOKIE = 'inventory_access';
export const REFRESH_COOKIE = 'inventory_refresh';

const isProduction = process.env.NODE_ENV === 'production';

export interface SessionCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: 'lax';
    secure: boolean;
    path: string;
    maxAge: number;
  };
}

/** Built here so route handlers, server actions and middleware all agree. */
export function sessionCookies(session: Session, refreshToken: string | null): SessionCookie[] {
  const base = { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/' } as const;
  const list: SessionCookie[] = [
    {
      name: ACCESS_COOKIE,
      value: session.accessToken,
      options: { ...base, maxAge: session.expiresIn },
    },
  ];

  if (refreshToken) {
    list.push({
      name: REFRESH_COOKIE,
      value: refreshToken,
      // Outliving the access token is the point: it is what renews it.
      options: { ...base, maxAge: 60 * 60 * 24 * 30 },
    });
  }

  return list;
}

export async function writeSession(session: Session, refreshToken: string | null): Promise<void> {
  const store = await cookies();

  for (const cookie of sessionCookies(session, refreshToken)) {
    store.set(cookie.name, cookie.value, cookie.options);
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/**
 * The signed-in user, or null. Server Components call this; it never throws, so
 * an expired token renders a signed-out page rather than an error.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getAccessToken();
  return token ? fetchCurrentUser(token) : null;
}
