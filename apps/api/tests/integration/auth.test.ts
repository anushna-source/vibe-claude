import { sessionResponseSchema } from '@inventory/shared';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bearer, createUser, refreshCookie } from '../helpers/auth.js';
import { createTestDatabase, type TestDatabase } from '../helpers/database.js';

/**
 * Registration is open, so these endpoints are the app's front door.
 * Everything here runs against real Postgres, never a mock.
 */

let harness: TestDatabase;
let app: Express;

const VALID = {
  fullName: 'Anush Sharma',
  email: 'anush@broadway.test',
  password: 'correct-horse-battery-staple',
};

beforeAll(async () => {
  harness = await createTestDatabase();
  app = createApp();
}, 60_000);

afterAll(async () => {
  await harness?.destroy();
});

describe('POST /api/v1/auth/signup', () => {
  it('creates an active viewer and returns a session', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send(VALID);

    expect(res.status).toBe(201);
    expect(sessionResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      email: 'anush@broadway.test',
      role: 'viewer',
      isActive: true,
    });
  });

  it('never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'hash-check@broadway.test' });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('password');
    expect(body).not.toContain('$argon2');
  });

  it('sets the refresh token in an httpOnly cookie, not the body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'cookie@broadway.test' });

    const cookie = refreshCookie(res.headers as Record<string, unknown>);
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(JSON.stringify(res.body)).not.toContain('refreshToken');
  });

  it('rejects a duplicate email', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'dupe@broadway.test' });

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'dupe@broadway.test' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('treats the email case-insensitively', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'Case@broadway.test' });

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'CASE@BROADWAY.TEST' });

    expect(res.status).toBe(409);
  });

  it.each([
    ['a short password', { password: 'short' }],
    ['a missing name', { fullName: '' }],
    ['a malformed email', { email: 'not-an-email' }],
  ])('rejects %s', async (_label, override) => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'validation@broadway.test', ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores a role supplied by the client', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'sneaky@broadway.test', role: 'admin', isActive: false });

    expect(res.body.data.user.role).toBe('viewer');
    expect(res.body.data.user.isActive).toBe(true);
  });

  it('writes an audit row', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'audited@broadway.test' });

    const rows = await harness.db
      .selectFrom('audit_logs')
      .select('action')
      .where('action', '=', 'user.signup')
      .execute();

    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    await createUser(harness.db, {
      email: 'login@broadway.test',
      password: 'correct-horse-battery-staple',
    });
    await createUser(harness.db, {
      email: 'inactive@broadway.test',
      password: 'correct-horse-battery-staple',
      isActive: false,
    });
  });

  it('signs a user in', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@broadway.test', password: 'correct-horse-battery-staple' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it.each([
    ['a wrong password', { email: 'login@broadway.test', password: 'wrong-password-here' }],
    ['an unknown email', { email: 'nobody@broadway.test', password: 'correct-horse-battery' }],
  ])('gives the same generic error for %s', async (_label, credentials) => {
    const res = await request(app).post('/api/v1/auth/login').send(credentials);

    expect(res.status).toBe(401);
    // Identical wording either way: a different message would let anyone
    // discover which emails have accounts.
    expect(res.body.error.message).toBe('Email or password is incorrect');
  });

  it('refuses a deactivated account', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@broadway.test', password: 'correct-horse-battery-staple' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the signed-in user', async () => {
    const user = await createUser(harness.db, { email: 'me@broadway.test' });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', bearer(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@broadway.test');
  });

  it.each([
    ['no header', undefined],
    ['a malformed header', 'Token abc'],
    ['a tampered token', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad-signature'],
    ['a random string', 'Bearer not-a-jwt'],
  ])('returns 401 for %s', async (_label, header) => {
    const req = request(app).get('/api/v1/auth/me');
    if (header) req.set('Authorization', header);

    const res = await req;
    expect(res.status).toBe(401);
  });
});

describe('refresh rotation', () => {
  async function signupAndGetCookie(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email });

    const cookie = refreshCookie(res.headers as Record<string, unknown>);
    if (!cookie) throw new Error('no refresh cookie was set');
    return cookie;
  }

  it('issues a new pair and rotates the old token', async () => {
    const cookie = await signupAndGetCookie('rotate@broadway.test');

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(refreshCookie(res.headers as Record<string, unknown>)).not.toBe(cookie);
  });

  it('revokes every session when a rotated token is presented again', async () => {
    const cookie = await signupAndGetCookie('reuse@broadway.test');

    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(rotated.status).toBe(200);

    const newCookie = refreshCookie(rotated.headers as Record<string, unknown>);
    expect(newCookie).toBeDefined();

    // Replaying the old token is the signature of a stolen cookie.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(replay.status).toBe(401);

    // The token issued moments ago is now dead too.
    const afterBreach = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', newCookie ?? '');
    expect(afterBreach.status).toBe(401);
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...VALID, email: 'logout@broadway.test' });

    const cookie = refreshCookie(signup.headers as Record<string, unknown>) ?? '';

    const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);

    const afterLogout = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
  });

  it('succeeds even with no session, so sign-out is never an error', async () => {
    const res = await request(app).post('/api/v1/auth/logout');

    expect(res.status).toBe(204);
  });
});
