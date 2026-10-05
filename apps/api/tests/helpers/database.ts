import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { env } from '../../src/config/env.js';
import { closeDb, createDb, createPool } from '../../src/db/client.js';
import { migrateAllDown, migrateToLatest } from '../../src/db/migrator.js';
import type { Database } from '../../src/db/types.js';

/**
 * Integration tests run against a real Postgres, never a mock (AGENTS.md).
 * Each harness gets its own schema so parallel runs cannot collide, and drops
 * it afterwards.
 */

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://inventory:inventory@localhost:5432/inventory_test';

export interface TestDatabase {
  db: Kysely<Database>;
  schema: string;
  /** Rolls every migration back, to prove `down` works. */
  migrateAllDown: () => Promise<void>;
  migrateUp: () => Promise<void>;
  destroy: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  // The same schema the app's own pool is pointed at (see tests/setup.ts), so a
  // request driven through supertest sees what this harness wrote.
  const schema = env.DB_SCHEMA ?? `test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const adminDb = createDb(createPool({ connectionString: TEST_URL, max: 2 }));
  try {
    await sql`create schema ${sql.id(schema)}`.execute(adminDb);
  } catch (cause) {
    await adminDb.destroy();
    throw new Error(
      `Could not reach the test database at ${TEST_URL.replace(/:\/\/[^@]*@/, '://***@')}. ` +
        'Run `pnpm db:up` first.',
      { cause },
    );
  }

  // A second pool pinned to the new schema, so unqualified DDL lands there.
  const db = createDb(createPool({ connectionString: TEST_URL, max: 5, schema }));

  const migrateUp = async (): Promise<void> => {
    const { error } = await migrateToLatest(db, schema);
    if (error) throw error;
  };

  await migrateUp();

  return {
    db,
    schema,
    migrateUp,
    migrateAllDown: async () => {
      const { error } = await migrateAllDown(db, schema);
      if (error) throw error;
    },
    destroy: async () => {
      // The app's pool points at this schema too; leaving it open hangs vitest.
      await closeDb();
      await db.destroy();
      await sql`drop schema if exists ${sql.id(schema)} cascade`.execute(adminDb);
      await adminDb.destroy();
    },
  };
}

/** Minimal rows the assignment tests need. */
export async function seedFixtures(db: Kysely<Database>): Promise<{
  categoryId: string;
  locationId: string;
  staffId: string;
  assetId: string;
}> {
  const category = await db
    .insertInto('categories')
    .values({ name: 'Laptop', code: 'LAP' })
    .returning('id')
    .executeTakeFirstOrThrow();

  const location = await db
    .insertInto('locations')
    .values({ name: 'Lab 1', type: 'lab' })
    .returning('id')
    .executeTakeFirstOrThrow();

  const staff = await db
    .insertInto('staff')
    .values({ employee_code: 'BI-EMP-001', full_name: 'Test Person' })
    .returning('id')
    .executeTakeFirstOrThrow();

  const asset = await db
    .insertInto('assets')
    .values({ asset_tag: 'BI-LAP-0001', category_id: category.id, name: 'ThinkPad T14' })
    .returning('id')
    .executeTakeFirstOrThrow();

  return {
    categoryId: category.id,
    locationId: location.id,
    staffId: staff.id,
    assetId: asset.id,
  };
}
