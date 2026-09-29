import type { Session } from '@inventory/shared';
import { describe, expect, it } from 'vitest';
import { ACCESS_COOKIE, REFRESH_COOKIE, sessionCookies } from '@/lib/session';

const session: Session = {
  user: {
    id: '3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90',
    email: 'viewer@broadway.test',
    fullName: 'Anush Sharma',
    role: 'viewer',
    isActive: true,
    createdAt: '2026-09-29T04:00:00.000Z',
    lastLoginAt: null,
  },
  accessToken: 'access-token-value',
  expiresIn: 900,
};

describe('sessionCookies', () => {
  it('keeps both tokens out of reach of page scripts', () => {
    const cookies = sessionCookies(session, 'refresh-token-value');

    for (const cookie of cookies) {
      expect(cookie.options.httpOnly).toBe(true);
      expect(cookie.options.sameSite).toBe('lax');
      expect(cookie.options.path).toBe('/');
    }
  });

  it('gives the access cookie the token lifetime', () => {
    const [access] = sessionCookies(session, null);

    expect(access?.name).toBe(ACCESS_COOKIE);
    expect(access?.value).toBe('access-token-value');
    expect(access?.options.maxAge).toBe(900);
  });

  it('outlives the access token with the refresh cookie, which renews it', () => {
    const cookies = sessionCookies(session, 'refresh-token-value');
    const refresh = cookies.find((cookie) => cookie.name === REFRESH_COOKIE);

    expect(refresh?.value).toBe('refresh-token-value');
    expect(refresh?.options.maxAge).toBeGreaterThan(session.expiresIn);
  });

  it('sets only the access cookie when the API did not rotate a refresh token', () => {
    const cookies = sessionCookies(session, null);

    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(ACCESS_COOKIE);
  });

  it('leaves Secure off in development so localhost still works', () => {
    // NODE_ENV is 'test' here, which is not production.
    const [access] = sessionCookies(session, null);

    expect(access?.options.secure).toBe(false);
  });
});
