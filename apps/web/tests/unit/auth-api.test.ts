import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentUser, login, logout, signup } from '@/lib/auth-api';

/**
 * These calls bypass lib/api-client because they need the API's Set-Cookie
 * header: the refresh token is re-issued as a first-party cookie by this app.
 */

const sessionBody = {
  data: {
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
  },
};

function respond(body: unknown, init: { status?: number; setCookie?: string[] } = {}): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const cookie of init.setCookie ?? []) headers.append('Set-Cookie', cookie);

  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

function mockFetch(impl: () => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(impl as typeof fetch);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signup', () => {
  it('returns the session and the refresh token from the cookie', async () => {
    mockFetch(() =>
      Promise.resolve(
        respond(sessionBody, {
          status: 201,
          setCookie: ['inventory_refresh=raw-refresh-token; Path=/api/v1/auth; HttpOnly'],
        }),
      ),
    );

    const result = await signup({
      fullName: 'Anush Sharma',
      email: 'viewer@broadway.test',
      password: 'correct-horse-battery-staple',
    });

    expect(result.session.accessToken).toBe('access-token-value');
    expect(result.refreshToken).toBe('raw-refresh-token');
  });

  it('reports the API error message so the form can show it', async () => {
    mockFetch(() =>
      Promise.resolve(
        respond(
          { error: { code: 'CONFLICT', message: 'An account with that email already exists' } },
          { status: 409 },
        ),
      ),
    );

    await expect(
      signup({ fullName: 'A', email: 'a@b.test', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
  });

  it('never surfaces a non-envelope error body', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response('<html>upstream password=hunter2</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    const error = await signup({
      fullName: 'A',
      email: 'a@b.test',
      password: 'correct-horse-battery',
    }).then(
      () => null,
      (cause: unknown) => cause as Error,
    );

    expect(error?.message).not.toContain('hunter2');
    expect(error?.message).toBe('The server returned an unexpected response');
  });
});

describe('login', () => {
  it('returns a null refresh token when the API set no cookie', async () => {
    mockFetch(() => Promise.resolve(respond(sessionBody)));

    const result = await login({ email: 'viewer@broadway.test', password: 'whatever' });

    expect(result.refreshToken).toBeNull();
  });

  it('rejects a response that is not a session envelope', async () => {
    mockFetch(() => Promise.resolve(respond({ data: { nonsense: true } })));

    await expect(login({ email: 'a@b.test', password: 'x' })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });

  it('reports an unreachable API as a network error', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));

    await expect(login({ email: 'a@b.test', password: 'x' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

describe('fetchCurrentUser', () => {
  it('returns the user for a valid token', async () => {
    mockFetch(() => Promise.resolve(respond({ data: sessionBody.data.user })));

    await expect(fetchCurrentUser('token')).resolves.toMatchObject({
      email: 'viewer@broadway.test',
    });
  });

  it('returns null rather than throwing when the token is rejected', async () => {
    mockFetch(() => Promise.resolve(respond({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })));

    await expect(fetchCurrentUser('expired')).resolves.toBeNull();
  });

  it('returns null when the API is unreachable, so the page renders signed out', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));

    await expect(fetchCurrentUser('token')).resolves.toBeNull();
  });
});

describe('logout', () => {
  it('does nothing without a refresh token', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(respond({})));

    await logout(undefined);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('succeeds even when the API is unreachable, so signing out never fails', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));

    await expect(logout('raw-refresh-token')).resolves.toBeUndefined();
  });
});
