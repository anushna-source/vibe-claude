import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { bearer, createUser } from '../helpers/auth.js';
import { createTestDatabase, type TestDatabase } from '../helpers/database.js';

/**
 * Behaviour of the three reference resources: the rules that protect the asset
 * tag format and stop references dangling.
 */

let harness: TestDatabase;
let app: Express;
let admin: Awaited<ReturnType<typeof createUser>>;
let auth: { Authorization: string };

beforeAll(async () => {
  harness = await createTestDatabase();
  app = createApp();
  admin = await createUser(harness.db, { email: 'admin@broadway.test', role: 'admin' });
  auth = { Authorization: bearer(admin.accessToken) };
}, 60_000);

afterAll(async () => {
  await harness?.destroy();
});

describe('departments', () => {
  it('creates and returns the camelCase shape', async () => {
    const res = await request(app)
      .post('/api/v1/departments')
      .set(auth)
      .send({ name: 'Academics' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Academics' });
    expect(res.body.data.createdAt).toBeTruthy();
    expect(res.body.data).not.toHaveProperty('created_at');
  });

  it('rejects a duplicate name with a readable message', async () => {
    await request(app).post('/api/v1/departments').set(auth).send({ name: 'Accounts' });

    const res = await request(app).post('/api/v1/departments').set(auth).send({ name: 'Accounts' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('A department with that name already exists');
    // Never the raw Postgres text.
    expect(res.body.error.message).not.toContain('duplicate key');
  });

  it('frees the name again once the row is soft deleted', async () => {
    const created = await request(app)
      .post('/api/v1/departments')
      .set(auth)
      .send({ name: 'Temporary' });

    await request(app).delete(`/api/v1/departments/${created.body.data.id}`).set(auth);

    const again = await request(app)
      .post('/api/v1/departments')
      .set(auth)
      .send({ name: 'Temporary' });

    expect(again.status).toBe(201);
  });

  it('refuses to delete a department that still has staff', async () => {
    const created = await request(app).post('/api/v1/departments').set(auth).send({ name: 'IT' });

    await harness.db
      .insertInto('staff')
      .values({
        employee_code: 'BI-EMP-100',
        full_name: 'Someone',
        department_id: created.body.data.id,
      })
      .execute();

    const res = await request(app).delete(`/api/v1/departments/${created.body.data.id}`).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('1 staff member');

    // And nothing changed.
    const still = await request(app).get('/api/v1/departments?q=IT').set(auth);
    expect(still.body.data.some((row: { name: string }) => row.name === 'IT')).toBe(true);
  });

  it('rejects a name that is too short', async () => {
    const res = await request(app).post('/api/v1/departments').set(auth).send({ name: 'A' });

    expect(res.status).toBe(400);
  });
});

describe('locations', () => {
  it('stores the type and optional fields', async () => {
    const res = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Lab 7', type: 'lab', building: 'Main', floor: '2' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ type: 'lab', building: 'Main', floor: '2' });
  });

  it('defaults absent optional fields to null rather than empty strings', async () => {
    const res = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Store room', type: 'store' });

    expect(res.body.data.building).toBeNull();
    expect(res.body.data.floor).toBeNull();
  });

  it('rejects a type that is not one of the known kinds', async () => {
    const res = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Rooftop', type: 'helipad' });

    expect(res.status).toBe(400);
  });

  it('filters by type', async () => {
    await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Room A', type: 'classroom' });
    await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Office B', type: 'office' });

    const res = await request(app).get('/api/v1/locations?type=classroom').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.every((row: { type: string }) => row.type === 'classroom')).toBe(true);
  });

  it('refuses to delete a location that still holds equipment', async () => {
    const location = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Lab 9', type: 'lab' });

    const category = await harness.db
      .insertInto('categories')
      .values({ name: 'Projector', code: 'PRJ' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const asset = await harness.db
      .insertInto('assets')
      .values({ asset_tag: 'BI-PRJ-0001', category_id: category.id, name: 'Epson' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await harness.db
      .insertInto('assignments')
      .values({
        asset_id: asset.id,
        assignee_type: 'location',
        location_id: location.body.data.id,
      })
      .execute();

    const res = await request(app).delete(`/api/v1/locations/${location.body.data.id}`).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('1 asset');
  });
});

describe('locations: duplicates and reuse', () => {
  it('rejects a duplicate name', async () => {
    await request(app).post('/api/v1/locations').set(auth).send({ name: 'Twin', type: 'office' });

    const res = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Twin', type: 'lab' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('A location with that name already exists');
  });

  it('rejects renaming onto an existing name', async () => {
    await request(app).post('/api/v1/locations').set(auth).send({ name: 'Taken', type: 'office' });
    const other = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Free', type: 'office' });

    const res = await request(app)
      .patch(`/api/v1/locations/${other.body.data.id}`)
      .set(auth)
      .send({ name: 'Taken' });

    expect(res.status).toBe(409);
  });

  it('frees the name once soft deleted', async () => {
    const created = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Recycled', type: 'store' });

    await request(app).delete(`/api/v1/locations/${created.body.data.id}`).set(auth);

    const again = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Recycled', type: 'store' });

    expect(again.status).toBe(201);
  });

  it('clears an optional field when it is sent empty', async () => {
    const created = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Clearable', type: 'office', building: 'Annex' });

    const res = await request(app)
      .patch(`/api/v1/locations/${created.body.data.id}`)
      .set(auth)
      .send({ building: '' });

    expect(res.body.data.building).toBeNull();
  });
});

describe('categories', () => {
  it('tells code and name duplicates apart', async () => {
    await request(app).post('/api/v1/categories').set(auth).send({ name: 'Switches', code: 'SWT' });

    const sameCode = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Different name', code: 'SWT' });

    const sameName = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Switches', code: 'SWX' });

    expect(sameCode.body.error.message).toContain('code');
    expect(sameName.body.error.message).toContain('name');
  });

  it('upper-cases the code', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Laptop', code: 'lap' });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('LAP');
  });

  it('starts the tag counter at 1 and never takes it from the request', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Desktop', code: 'DSK', nextTagNumber: 9999 });

    expect(res.body.data.nextTagNumber).toBe(1);
  });

  it('rejects a code that is not two to six letters', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Bad', code: 'L4P' });

    expect(res.status).toBe(400);
  });

  it('lets the code be corrected while the category is unused', async () => {
    const created = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Netwrok gear', code: 'NTW' });

    const res = await request(app)
      .patch(`/api/v1/categories/${created.body.data.id}`)
      .set(auth)
      .send({ name: 'Network gear', code: 'NET' });

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe('NET');
  });

  it('freezes the code once an asset carries it in a tag', async () => {
    const created = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Phone', code: 'PHN' });

    await harness.db
      .insertInto('assets')
      .values({
        asset_tag: 'BI-PHN-0001',
        category_id: created.body.data.id,
        name: 'Pixel',
      })
      .execute();

    const res = await request(app)
      .patch(`/api/v1/categories/${created.body.data.id}`)
      .set(auth)
      .send({ code: 'MOB' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('cannot change');

    // The tag prefix still matches the category.
    const unchanged = await request(app).get('/api/v1/categories?q=PHN').set(auth);
    expect(unchanged.body.data[0].code).toBe('PHN');
  });

  it('still allows renaming a category that has assets', async () => {
    const created = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Display', code: 'DSP' });

    await harness.db
      .insertInto('assets')
      .values({ asset_tag: 'BI-DSP-0001', category_id: created.body.data.id, name: 'Dell' })
      .execute();

    const res = await request(app)
      .patch(`/api/v1/categories/${created.body.data.id}`)
      .set(auth)
      .send({ name: 'Displays and monitors' });

    expect(res.status).toBe(200);
  });

  it('refuses to delete a category that still has assets', async () => {
    const created = await request(app)
      .post('/api/v1/categories')
      .set(auth)
      .send({ name: 'Peripheral', code: 'PER' });

    await harness.db
      .insertInto('assets')
      .values({ asset_tag: 'BI-PER-0001', category_id: created.body.data.id, name: 'Keyboard' })
      .execute();

    const res = await request(app).delete(`/api/v1/categories/${created.body.data.id}`).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('1 asset');
  });
});

describe('listing', () => {
  beforeAll(async () => {
    for (let index = 0; index < 7; index += 1) {
      await request(app)
        .post('/api/v1/departments')
        .set(auth)
        .send({ name: `Paged dept ${index}` });
    }
  });

  it('pages and reports the real total', async () => {
    const res = await request(app).get('/api/v1/departments?page=1&limit=3&q=Paged').set(auth);

    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 3, total: 7 });
  });

  it('returns the next page', async () => {
    const first = await request(app).get('/api/v1/departments?page=1&limit=3&q=Paged').set(auth);
    const second = await request(app).get('/api/v1/departments?page=2&limit=3&q=Paged').set(auth);

    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
  });

  it('returns an empty list rather than an error when nothing matches', async () => {
    const res = await request(app).get('/api/v1/departments?q=nothing-matches-this').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('rejects a limit beyond the maximum', async () => {
    const res = await request(app).get('/api/v1/departments?limit=500').set(auth);

    expect(res.status).toBe(400);
  });
});

describe('audit trail', () => {
  it('records create, update and delete with before and after', async () => {
    const created = await request(app)
      .post('/api/v1/locations')
      .set(auth)
      .send({ name: 'Audited room', type: 'office' });

    const id = created.body.data.id;
    await request(app).patch(`/api/v1/locations/${id}`).set(auth).send({ name: 'Renamed room' });
    await request(app).delete(`/api/v1/locations/${id}`).set(auth);

    const rows = await harness.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('entity_id', '=', id)
      .orderBy('created_at', 'asc')
      .execute();

    expect(rows.map((row) => row.action)).toEqual([
      'location.create',
      'location.update',
      'location.delete',
    ]);
    expect(rows.every((row) => row.actor_id === admin.id)).toBe(true);
    expect(JSON.stringify(rows[1]?.before)).toContain('Audited room');
    expect(JSON.stringify(rows[1]?.after)).toContain('Renamed room');
  });
});
