import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bearer, createUser } from '../helpers/auth.js';
import { createTestDatabase, type TestDatabase } from '../helpers/database.js';

/**
 * AGENTS.md makes RBAC denial coverage mandatory. Registration is open, so every
 * one of these callers is someone who simply signed up.
 */

let harness: TestDatabase;
let app: Express;
let admin: Awaited<ReturnType<typeof createUser>>;
let viewer: Awaited<ReturnType<typeof createUser>>;
let itStaff: Awaited<ReturnType<typeof createUser>>;

beforeAll(async () => {
  harness = await createTestDatabase();
  app = createApp();

  admin = await createUser(harness.db, { email: 'admin@broadway.test', role: 'admin' });
  viewer = await createUser(harness.db, { email: 'viewer@broadway.test', role: 'viewer' });
  itStaff = await createUser(harness.db, { email: 'it@broadway.test', role: 'it_staff' });
}, 60_000);

afterAll(async () => {
  await harness?.destroy();
});

describe('GET /api/v1/users is admin only', () => {
  it('allows an admin', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', bearer(admin.accessToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it.each([
    ['a viewer', () => viewer],
    ['it staff', () => itStaff],
  ])('refuses %s with 403', async (_label, who) => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', bearer(who().accessToken));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses an anonymous caller with 401, not 403', async () => {
    const res = await request(app).get('/api/v1/users');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('never exposes a password hash in the list', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', bearer(admin.accessToken));

    expect(JSON.stringify(res.body)).not.toContain('$argon2');
    expect(res.body.data[0]).not.toHaveProperty('passwordHash');
  });
});

describe('PATCH /api/v1/users/:id is admin only', () => {
  it('lets an admin promote a viewer', async () => {
    const target = await createUser(harness.db, { email: 'promote@broadway.test' });

    const res = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ role: 'it_staff' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('it_staff');
  });

  it('refuses a viewer trying to promote themselves', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${viewer.id}`)
      .set('Authorization', bearer(viewer.accessToken))
      .send({ role: 'admin' });

    expect(res.status).toBe(403);

    const unchanged = await harness.db
      .selectFrom('users')
      .select('role')
      .where('id', '=', viewer.id)
      .executeTakeFirstOrThrow();

    expect(unchanged.role).toBe('viewer');
  });

  it('stops an admin from changing their own role', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${admin.id}`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ role: 'viewer' });

    expect(res.status).toBe(409);
  });

  it('revokes live sessions when an account is deactivated', async () => {
    const target = await createUser(harness.db, { email: 'deactivate@broadway.test' });

    await harness.db
      .insertInto('refresh_sessions')
      .values({
        user_id: target.id,
        token_hash: 'hash-for-deactivation-test',
        expires_at: new Date(Date.now() + 86_400_000),
      })
      .execute();

    await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ isActive: false });

    const sessions = await harness.db
      .selectFrom('refresh_sessions')
      .select('revoked_at')
      .where('user_id', '=', target.id)
      .execute();

    expect(sessions.every((session) => session.revoked_at !== null)).toBe(true);
  });

  it('rejects an unknown user id', async () => {
    const res = await request(app)
      .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', bearer(admin.accessToken))
      .send({ role: 'viewer' });

    expect(res.status).toBe(404);
  });

  it('rejects a malformed id before touching the service', async () => {
    const res = await request(app)
      .patch('/api/v1/users/not-a-uuid')
      .set('Authorization', bearer(admin.accessToken))
      .send({ role: 'viewer' });

    expect(res.status).toBe(400);
  });

  it('writes an audit row with before and after', async () => {
    const target = await createUser(harness.db, { email: 'audit-role@broadway.test' });

    await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ role: 'it_staff' });

    const row = await harness.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('entity_id', '=', target.id)
      .where('action', '=', 'user.update')
      .executeTakeFirstOrThrow();

    expect(row.actor_id).toBe(admin.id);
    expect(JSON.stringify(row.before)).toContain('viewer');
    expect(JSON.stringify(row.after)).toContain('it_staff');
  });
});
