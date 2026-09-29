import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, seedFixtures, type TestDatabase } from '../helpers/database.js';

/**
 * The domain rules in AGENTS.md are enforced by the database, so these tests
 * talk to a real Postgres. If one of them fails, an invariant is broken.
 */

let harness: TestDatabase;
let fixtures: Awaited<ReturnType<typeof seedFixtures>>;

beforeAll(async () => {
  harness = await createTestDatabase();
  fixtures = await seedFixtures(harness.db);
}, 60_000);

afterAll(async () => {
  // beforeAll may have failed before the harness existed.
  await harness?.destroy();
});

describe('rule 2: one live assignment per asset', () => {
  it('rejects a second live assignment for the same asset', async () => {
    const { db } = harness;
    const { assetId, staffId, locationId } = fixtures;

    await db
      .insertInto('assignments')
      .values({ asset_id: assetId, assignee_type: 'staff', staff_id: staffId })
      .execute();

    await expect(
      db
        .insertInto('assignments')
        .values({ asset_id: assetId, assignee_type: 'location', location_id: locationId })
        .execute(),
    ).rejects.toThrow(/assignments_one_live_per_asset/);
  });

  it('allows a new assignment once the previous one is returned', async () => {
    const { db } = harness;
    const { locationId, categoryId } = fixtures;

    const asset = await db
      .insertInto('assets')
      .values({ asset_tag: 'BI-LAP-0002', category_id: categoryId, name: 'Projector' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const first = await db
      .insertInto('assignments')
      .values({ asset_id: asset.id, assignee_type: 'location', location_id: locationId })
      .returning('id')
      .executeTakeFirstOrThrow();

    await db
      .updateTable('assignments')
      .set({ returned_at: new Date() })
      .where('id', '=', first.id)
      .execute();

    await expect(
      db
        .insertInto('assignments')
        .values({ asset_id: asset.id, assignee_type: 'location', location_id: locationId })
        .execute(),
    ).resolves.toBeDefined();
  });
});

describe('rule 6: a person or a location, never both', () => {
  it('rejects an assignment naming both', async () => {
    const { db } = harness;
    const { categoryId, staffId, locationId } = fixtures;

    const asset = await db
      .insertInto('assets')
      .values({ asset_tag: 'BI-LAP-0003', category_id: categoryId, name: 'Laptop' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await expect(
      db
        .insertInto('assignments')
        .values({
          asset_id: asset.id,
          assignee_type: 'staff',
          staff_id: staffId,
          location_id: locationId,
        })
        .execute(),
    ).rejects.toThrow(/assignments_assignee_exclusive/);
  });

  it('rejects an assignment naming neither', async () => {
    const { db } = harness;
    const { categoryId } = fixtures;

    const asset = await db
      .insertInto('assets')
      .values({ asset_tag: 'BI-LAP-0004', category_id: categoryId, name: 'Laptop' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await expect(
      db.insertInto('assignments').values({ asset_id: asset.id, assignee_type: 'staff' }).execute(),
    ).rejects.toThrow(/assignments_assignee_exclusive/);
  });

  it('rejects a staff assignment that names a location instead', async () => {
    const { db } = harness;
    const { categoryId, locationId } = fixtures;

    const asset = await db
      .insertInto('assets')
      .values({ asset_tag: 'BI-LAP-0005', category_id: categoryId, name: 'Laptop' })
      .returning('id')
      .executeTakeFirstOrThrow();

    await expect(
      db
        .insertInto('assignments')
        .values({ asset_id: asset.id, assignee_type: 'staff', location_id: locationId })
        .execute(),
    ).rejects.toThrow(/assignments_assignee_exclusive/);
  });
});

describe('rule 1: asset tags are immutable', () => {
  it('rejects an attempt to change asset_tag', async () => {
    const { db } = harness;

    await expect(
      db
        .updateTable('assets')
        .set({ asset_tag: 'BI-LAP-9999' })
        .where('id', '=', fixtures.assetId)
        .execute(),
    ).rejects.toThrow(/asset_tag is immutable/);
  });

  it('allows other columns to change', async () => {
    const { db } = harness;

    await expect(
      db
        .updateTable('assets')
        .set({ name: 'ThinkPad T14 Gen 3' })
        .where('id', '=', fixtures.assetId)
        .execute(),
    ).resolves.toBeDefined();
  });

  it('rejects a tag that does not match the BI-<CAT>-<NNNN> format', async () => {
    const { db } = harness;

    await expect(
      db
        .insertInto('assets')
        .values({ asset_tag: 'laptop-1', category_id: fixtures.categoryId, name: 'Bad tag' })
        .execute(),
    ).rejects.toThrow(/assets_tag_format/);
  });
});

describe('rule 4: asset_events and audit_logs are append-only', () => {
  it('allows inserts into asset_events', async () => {
    const { db } = harness;

    await expect(
      db
        .insertInto('asset_events')
        .values({ asset_id: fixtures.assetId, event_type: 'created' })
        .execute(),
    ).resolves.toBeDefined();
  });

  it('rejects an update of asset_events', async () => {
    const { db } = harness;

    await expect(
      db.updateTable('asset_events').set({ note: 'tampered' }).execute(),
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a delete from asset_events', async () => {
    const { db } = harness;

    await expect(db.deleteFrom('asset_events').execute()).rejects.toThrow(/append-only/);
  });

  it('rejects an update of audit_logs', async () => {
    const { db } = harness;

    await db
      .insertInto('audit_logs')
      .values({ action: 'asset.create', entity_type: 'asset', entity_id: fixtures.assetId })
      .execute();

    await expect(
      db.updateTable('audit_logs').set({ action: 'tampered' }).execute(),
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a delete from audit_logs', async () => {
    const { db } = harness;

    await expect(db.deleteFrom('audit_logs').execute()).rejects.toThrow(/append-only/);
  });

  it('has no deleted_at column, because a soft delete would be a rewrite', async () => {
    const { db, schema } = harness;

    const columns = await sql<{ column_name: string }>`
      select column_name from information_schema.columns
      where table_schema = ${schema} and table_name in ('asset_events', 'audit_logs')
    `.execute(db);

    expect(columns.rows.map((row) => row.column_name)).not.toContain('deleted_at');
  });
});

describe('rule 5: soft deletes', () => {
  it('frees a unique code once the row is soft deleted', async () => {
    const { db } = harness;

    await db.insertInto('departments').values({ name: 'Temporary' }).execute();

    await expect(
      db.insertInto('departments').values({ name: 'Temporary' }).execute(),
    ).rejects.toThrow(/departments_name_unique_live/);

    await db
      .updateTable('departments')
      .set({ deleted_at: new Date() })
      .where('name', '=', 'Temporary')
      .execute();

    await expect(
      db.insertInto('departments').values({ name: 'Temporary' }).execute(),
    ).resolves.toBeDefined();
  });

  it('treats user emails case-insensitively', async () => {
    const { db } = harness;

    await db
      .insertInto('users')
      .values({ email: 'Admin@Broadway.test', full_name: 'Admin', password_hash: 'x' })
      .execute();

    await expect(
      db
        .insertInto('users')
        .values({ email: 'admin@broadway.test', full_name: 'Copy', password_hash: 'x' })
        .execute(),
    ).rejects.toThrow(/users_email_unique_live/);
  });
});

describe('rule 7: money and time', () => {
  it('round-trips an NPR amount exactly, with no float drift', async () => {
    const { db } = harness;

    const asset = await db
      .insertInto('assets')
      .values({
        asset_tag: 'BI-LAP-0010',
        category_id: fixtures.categoryId,
        name: 'Priced',
        purchase_price: '132456.78',
      })
      .returning(['id', 'purchase_price'])
      .executeTakeFirstOrThrow();

    expect(asset.purchase_price).toBe('132456.78');
    // A string, not a number: floats lose paisa.
    expect(typeof asset.purchase_price).toBe('string');
  });

  it('rejects a negative purchase price', async () => {
    const { db } = harness;

    await expect(
      db
        .insertInto('assets')
        .values({
          asset_tag: 'BI-LAP-0011',
          category_id: fixtures.categoryId,
          name: 'Negative',
          purchase_price: '-1.00',
        })
        .execute(),
    ).rejects.toThrow(/assets_purchase_price_non_negative/);
  });

  it('stores timestamps as timestamptz', async () => {
    const { db, schema } = harness;

    const result = await sql<{ data_type: string }>`
      select data_type from information_schema.columns
      where table_schema = ${schema} and table_name = 'assets' and column_name = 'created_at'
    `.execute(db);

    expect(result.rows[0]?.data_type).toBe('timestamp with time zone');
  });
});

describe('updated_at trigger', () => {
  it('moves updated_at on write but leaves created_at alone', async () => {
    const { db } = harness;

    const before = await db
      .selectFrom('assets')
      .select(['created_at', 'updated_at'])
      .where('id', '=', fixtures.assetId)
      .executeTakeFirstOrThrow();

    await db
      .updateTable('assets')
      .set({ notes: 'touched' })
      .where('id', '=', fixtures.assetId)
      .execute();

    const after = await db
      .selectFrom('assets')
      .select(['created_at', 'updated_at'])
      .where('id', '=', fixtures.assetId)
      .executeTakeFirstOrThrow();

    expect(after.updated_at.getTime()).toBeGreaterThanOrEqual(before.updated_at.getTime());
    expect(after.created_at.getTime()).toBe(before.created_at.getTime());
  });
});

describe('asset tag counter', () => {
  it('starts every category at 1', async () => {
    const { db } = harness;

    const category = await db
      .selectFrom('categories')
      .select('next_tag_number')
      .where('id', '=', fixtures.categoryId)
      .executeTakeFirstOrThrow();

    expect(category.next_tag_number).toBe(1);
  });

  it('rejects a category code that is not upper case letters', async () => {
    const { db } = harness;

    await expect(
      db.insertInto('categories').values({ name: 'Bad', code: 'lap1' }).execute(),
    ).rejects.toThrow(/categories_code_format/);
  });
});
