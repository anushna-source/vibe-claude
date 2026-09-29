import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { type Kysely } from 'kysely';
// Kysely 0.29 moved the migrator out of the package root.
import {
  Migrator,
  type Migration,
  type MigrationProvider,
  type MigrationResult,
} from 'kysely/migration';
import type { Database } from './types.js';

const migrationFolder = fileURLToPath(new URL('../../migrations', import.meta.url));

/**
 * Kysely's FileMigrationProvider imports by filesystem path, which Node's ESM
 * loader rejects on Windows ("Only URLs with a scheme in: file, data, and node").
 * This converts to a file:// URL first. Migrations are TypeScript, so they run
 * through tsx (`pnpm db:migrate`), not through the compiled output.
 */
class EsmFileMigrationProvider implements MigrationProvider {
  constructor(private readonly folder: string) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const entries = await fs.readdir(this.folder);
    const migrations: Record<string, Migration> = {};

    for (const file of entries.sort()) {
      if (file.endsWith('.d.ts') || !/\.(?:ts|js|mts|mjs)$/.test(file)) continue;

      const href = pathToFileURL(path.join(this.folder, file)).href;
      const loaded = (await import(href)) as Migration;
      migrations[file.replace(/\.(?:ts|js|mts|mjs)$/, '')] = loaded;
    }

    return migrations;
  }
}

export function createMigrator(db: Kysely<Database>, schema?: string): Migrator {
  return new Migrator({
    db,
    provider: new EsmFileMigrationProvider(migrationFolder),
    ...(schema ? { migrationTableSchema: schema } : {}),
  });
}

export interface MigrationOutcome {
  results: readonly MigrationResult[];
  error: unknown;
}

export async function migrateToLatest(
  db: Kysely<Database>,
  schema?: string,
): Promise<MigrationOutcome> {
  const { error, results } = await createMigrator(db, schema).migrateToLatest();
  return { results: results ?? [], error };
}

export async function migrateDown(
  db: Kysely<Database>,
  schema?: string,
): Promise<MigrationOutcome> {
  const { error, results } = await createMigrator(db, schema).migrateDown();
  return { results: results ?? [], error };
}

/** Rolls every migration back, one step at a time. */
export async function migrateAllDown(
  db: Kysely<Database>,
  schema?: string,
): Promise<MigrationOutcome> {
  const migrator = createMigrator(db, schema);
  const applied: MigrationResult[] = [];

  for (;;) {
    const { error, results } = await migrator.migrateDown();
    if (error) return { results: applied, error };
    if (!results || results.length === 0) return { results: applied, error: undefined };
    applied.push(...results);
  }
}
