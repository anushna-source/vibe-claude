import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, createPool, isDatabaseReachable, withTransaction } from '../../src/db/client.js';
import { createTestDatabase, seedFixtures, type TestDatabase } from '../helpers/database.js';

/**
 * AGENTS.md rule 3: assign, return and transfer write several tables and must
 * be all-or-nothing. withTransaction is the helper those services will use, so
 * its rollback behaviour is tested here rather than assumed.
 */

let harness: TestDatabase;
let fixtures: Awaited<ReturnType<typeof seedFixtures>>;

beforeAll(async () => {
  harness = await createTestDatabase();
  fixtures = await seedFixtures(harness.db);
}, 60_000);

afterAll(async () => {
  await harness?.destroy();
});

describe('withTransaction', () => {
  it('commits every write when the callback succeeds', async () => {
    const { db } = harness;

    await withTransaction(async (trx) => {
      await trx
        .insertInto('asset_events')
        .values({ asset_id: fixtures.assetId, event_type: 'created', note: 'committed' })
        .execute();

      await trx
        .updateTable('assets')
        .set({ status: 'in_repair' })
        .where('id', '=', fixtures.assetId)
        .execute();
    }, db);

    const asset = await db
      .selectFrom('assets')
      .select('status')
      .where('id', '=', fixtures.assetId)
      .executeTakeFirstOrThrow();

    const events = await db
      .selectFrom('asset_events')
      .select('note')
      .where('note', '=', 'committed')
      .execute();

    expect(asset.status).toBe('in_repair');
    expect(events).toHaveLength(1);
  });

  it('rolls back every write when the callback throws', async () => {
    const { db } = harness;

    await expect(
      withTransaction(async (trx) => {
        await trx
          .insertInto('asset_events')
          .values({ asset_id: fixtures.assetId, event_type: 'assigned', note: 'rolled back' })
          .execute();

        await trx
          .updateTable('assets')
          .set({ status: 'lost' })
          .where('id', '=', fixtures.assetId)
          .execute();

        throw new Error('something failed halfway through');
      }, db),
    ).rejects.toThrow('something failed halfway through');

    const asset = await db
      .selectFrom('assets')
      .select('status')
      .where('id', '=', fixtures.assetId)
      .executeTakeFirstOrThrow();

    const events = await db
      .selectFrom('asset_events')
      .select('note')
      .where('note', '=', 'rolled back')
      .execute();

    // Neither half survived: all of it, or none of it.
    expect(asset.status).toBe('in_repair');
    expect(events).toHaveLength(0);
  });

  it('rolls back when a database constraint rejects the second write', async () => {
    const { db } = harness;

    await expect(
      withTransaction(async (trx) => {
        await trx
          .insertInto('assignments')
          .values({
            asset_id: fixtures.assetId,
            assignee_type: 'staff',
            staff_id: fixtures.staffId,
          })
          .execute();

        // Violates the one-live-assignment index.
        await trx
          .insertInto('assignments')
          .values({
            asset_id: fixtures.assetId,
            assignee_type: 'location',
            location_id: fixtures.locationId,
          })
          .execute();
      }, db),
    ).rejects.toThrow(/assignments_one_live_per_asset/);

    const assignments = await db
      .selectFrom('assignments')
      .select('id')
      .where('asset_id', '=', fixtures.assetId)
      .execute();

    expect(assignments).toHaveLength(0);
  });
});

describe('isDatabaseReachable', () => {
  it('is true when the database answers', async () => {
    await expect(isDatabaseReachable(harness.db)).resolves.toBe(true);
  });

  it('is false when it cannot connect, rather than throwing', async () => {
    const unreachable = createDb(
      createPool({
        // Nothing listens here.
        connectionString: 'postgres://inventory:inventory@127.0.0.1:59999/inventory',
        max: 1,
        connectionTimeoutMillis: 1_000,
      }),
    );

    await expect(isDatabaseReachable(unreachable)).resolves.toBe(false);
    await unreachable.destroy();
  }, 20_000);
});
