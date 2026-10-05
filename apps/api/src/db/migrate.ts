/**
 * CLI entry point: `pnpm db:migrate` and `pnpm db:migrate:down`.
 * Migrations are one-way in review terms — never edit an applied one — but the
 * down step exists so a bad migration can be backed out locally.
 */
import { closeDb, db } from './client.js';
import { migrateDown, migrateToLatest } from './migrator.js';

const direction = process.argv[2] === 'down' ? 'down' : 'latest';

async function main(): Promise<void> {
  const { results, error } = await (direction === 'down' ? migrateDown(db) : migrateToLatest(db));

  for (const result of results) {
    const state = result.status === 'Success' ? 'applied' : 'FAILED';
    // eslint-disable-next-line no-console -- this is a CLI, not the server
    console.log(`${state}: ${result.migrationName} (${result.direction})`);
  }

  if (error) {
    // eslint-disable-next-line no-console -- this is a CLI, not the server
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    await closeDb();
    process.exit(1);
  }

  if (results.length === 0) {
    // eslint-disable-next-line no-console -- this is a CLI, not the server
    console.log(direction === 'down' ? 'Nothing to roll back.' : 'Already up to date.');
  }

  await closeDb();
}

await main();
