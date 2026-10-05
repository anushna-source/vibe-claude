import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { Database } from './types.js';

/**
 * One pool for the process. Anything that changes an asset's state must go
 * through withTransaction (AGENTS.md rule 3).
 */

// numeric must not become a JavaScript float (rule 7): keep it a string.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value: string) => value);
// int8 counts fit comfortably in a JS number for this dataset.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));

export interface PoolOptions {
  connectionString: string;
  max?: number;
  connectionTimeoutMillis?: number;
  /** Prepends a schema to the search path; used to isolate test runs. */
  schema?: string;
}

export function createPool(options: PoolOptions): pg.Pool {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? env.DB_POOL_MAX,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? env.DB_CONNECT_TIMEOUT_MS,
    ...(options.schema ? { options: `-c search_path=${options.schema},public` } : {}),
  });

  pool.on('error', (error) => {
    // An idle client failed. Never log the connection string.
    logger.error({ err: error }, 'Unexpected database pool error');
  });

  return pool;
}

export function createDb(pool: pg.Pool): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

export const pool: pg.Pool = createPool({
  connectionString: env.DATABASE_URL,
  ...(env.DB_SCHEMA ? { schema: env.DB_SCHEMA } : {}),
});
export const db: Kysely<Database> = createDb(pool);

/**
 * Runs the callback in one transaction. Assign, return, transfer and
 * purchase-receive all write several tables and must be all-or-nothing.
 */
export function withTransaction<T>(
  fn: (trx: Transaction<Database>) => Promise<T>,
  database: Kysely<Database> = db,
): Promise<T> {
  return database.transaction().execute(fn);
}

/** True when the database answers. Used by the readiness probe. */
export async function isDatabaseReachable(database: Kysely<Database> = db): Promise<boolean> {
  try {
    await database.selectNoFrom((eb) => eb.lit(1).as('ok')).executeTakeFirstOrThrow();
    return true;
  } catch (error) {
    logger.warn({ err: error }, 'Database readiness check failed');
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await db.destroy();
}
