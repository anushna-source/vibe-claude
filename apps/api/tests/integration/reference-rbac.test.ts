import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bearer, createUser } from '../helpers/auth.js';
import { createTestDatabase, type TestDatabase } from '../helpers/database.js';

/**
 * AGENTS.md makes RBAC denial coverage mandatory. Registration is open, so a
 * Viewer here is simply anyone who signed up: they must not be able to change
 * reference data, and the server must refuse them regardless of what the UI shows.
 */

let harness: TestDatabase;
let app: Express;
let admin: Awaited<ReturnType<typeof createUser>>;
let itStaff: Awaited<ReturnType<typeof createUser>>;
let viewer: Awaited<ReturnType<typeof createUser>>;

const RESOURCES = ['departments', 'locations', 'categories'] as const;

/** A valid create body per resource. */
function body(resource: (typeof RESOURCES)[number], suffix: string): Record<string, unknown> {
  switch (resource) {
    case 'departments':
      return { name: `Department ${suffix}` };
    case 'locations':
      return { name: `Location ${suffix}`, type: 'lab' };
    case 'categories':
      return { name: `Category ${suffix}`, code: suffix.slice(0, 3).toUpperCase().padEnd(3, 'X') };
  }
}

beforeAll(async () => {
  harness = await createTestDatabase();
  app = createApp();

  admin = await createUser(harness.db, { email: 'admin@broadway.test', role: 'admin' });
  itStaff = await createUser(harness.db, { email: 'it@broadway.test', role: 'it_staff' });
  viewer = await createUser(harness.db, { email: 'viewer@broadway.test', role: 'viewer' });
}, 60_000);

afterAll(async () => {
  await harness?.destroy();
});

describe.each(RESOURCES)('%s access control', (resource) => {
  const path = `/api/v1/${resource}`;

  it('lets any signed-in user read', async () => {
    const res = await request(app).get(path).set('Authorization', bearer(viewer.accessToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('refuses an anonymous reader with 401, not 403', async () => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('lets an admin create', async () => {
    const res = await request(app)
      .post(path)
      .set('Authorization', bearer(admin.accessToken))
      .send(body(resource, 'adm'));

    expect(res.status).toBe(201);
  });

  it('lets it staff create', async () => {
    const res = await request(app)
      .post(path)
      .set('Authorization', bearer(itStaff.accessToken))
      .send(body(resource, 'its'));

    expect(res.status).toBe(201);
  });

  it('refuses a viewer creating', async () => {
    const res = await request(app)
      .post(path)
      .set('Authorization', bearer(viewer.accessToken))
      .send(body(resource, 'vwr'));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a viewer editing', async () => {
    const created = await request(app)
      .post(path)
      .set('Authorization', bearer(admin.accessToken))
      .send(body(resource, 'edt'));

    const res = await request(app)
      .patch(`${path}/${created.body.data.id}`)
      .set('Authorization', bearer(viewer.accessToken))
      .send({ name: 'Renamed by a viewer' });

    expect(res.status).toBe(403);
  });

  it('refuses it staff deleting, which is admin only', async () => {
    const created = await request(app)
      .post(path)
      .set('Authorization', bearer(admin.accessToken))
      .send(body(resource, 'del'));

    const res = await request(app)
      .delete(`${path}/${created.body.data.id}`)
      .set('Authorization', bearer(itStaff.accessToken));

    expect(res.status).toBe(403);
  });

  it('lets an admin delete', async () => {
    const created = await request(app)
      .post(path)
      .set('Authorization', bearer(admin.accessToken))
      .send(body(resource, 'adl'));

    const res = await request(app)
      .delete(`${path}/${created.body.data.id}`)
      .set('Authorization', bearer(admin.accessToken));

    expect(res.status).toBe(204);
  });

  it('rejects a malformed id before reaching the service', async () => {
    const res = await request(app)
      .patch(`${path}/not-a-uuid`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ name: 'Whatever' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an id that does not exist', async () => {
    const res = await request(app)
      .patch(`${path}/3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ name: 'Missing thing' });

    expect(res.status).toBe(404);
  });

  it('rejects an empty update rather than silently doing nothing', async () => {
    const created = await request(app)
      .post(path)
      .set('Authorization', bearer(admin.accessToken))
      .send(body(resource, 'emp'));

    const res = await request(app)
      .patch(`${path}/${created.body.data.id}`)
      .set('Authorization', bearer(admin.accessToken))
      .send({});

    expect(res.status).toBe(400);
  });
});
