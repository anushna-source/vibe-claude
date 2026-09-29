import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/database.js';

/**
 * CLAUDE.md requires every migration to ship a down step. This proves they work
 * rather than taking it on trust.
 */

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  // beforeAll may have failed before the harness existed.
  await harness?.destroy();
});

async function tableNames(): Promise<string[]> {
  const result = await sql<{ table_name: string }>`
    select table_name from information_schema.tables
    where table_schema = ${harness.schema} and table_name not like 'kysely_%'
    order by table_name
  `.execute(harness.db);

  return result.rows.map((row) => row.table_name);
}

describe('migrations', () => {
  it('creates every MVP table on the way up', async () => {
    expect(await tableNames()).toEqual([
      'asset_events',
      'assets',
      'assignments',
      'audit_logs',
      'categories',
      'departments',
      'locations',
      'refresh_sessions',
      'staff',
      'users',
    ]);
  });

  it('rolls all the way down and back up again', async () => {
    await harness.migrateAllDown();
    expect(await tableNames()).toEqual([]);

    await harness.migrateUp();
    expect(await tableNames()).toHaveLength(10);
  }, 60_000);

  it('drops its enum types on the way down', async () => {
    await harness.migrateAllDown();

    const types = await sql<{ typname: string }>`
      select t.typname from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = ${harness.schema}
    `.execute(harness.db);

    expect(types.rows.map((row) => row.typname)).not.toContain('asset_status');

    await harness.migrateUp();
  }, 60_000);
});
