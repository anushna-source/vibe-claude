import { sql, type Kysely } from 'kysely';

/**
 * The two append-only tables: the asset timeline and the audit trail.
 * AGENTS.md rule 4 says they are never updated or deleted, so the database
 * refuses both. They carry no deleted_at: a soft delete would be a rewrite.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrations run before the Database type exists
type Db = Kysely<any>;

export async function up(db: Db): Promise<void> {
  await db.schema
    .createTable('asset_events')
    .addColumn('id', 'bigserial', (c) => c.primaryKey())
    .addColumn('asset_id', 'uuid', (c) => c.notNull().references('assets.id').onDelete('restrict'))
    .addColumn('event_type', sql`asset_event_type`, (c) => c.notNull())
    .addColumn('assignment_id', 'uuid', (c) => c.references('assignments.id').onDelete('restrict'))
    .addColumn('actor_id', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('payload', 'jsonb', (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('note', 'text')
    .addColumn('occurred_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('audit_logs')
    .addColumn('id', 'bigserial', (c) => c.primaryKey())
    .addColumn('actor_id', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('action', 'text', (c) => c.notNull())
    .addColumn('entity_type', 'text', (c) => c.notNull())
    .addColumn('entity_id', 'text', (c) => c.notNull())
    .addColumn('before', 'jsonb')
    .addColumn('after', 'jsonb')
    .addColumn('request_id', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  // The timeline is read per asset, newest first.
  await db.schema
    .createIndex('asset_events_asset_id_occurred_at_idx')
    .on('asset_events')
    .columns(['asset_id', 'occurred_at'])
    .execute();

  await db.schema
    .createIndex('audit_logs_entity_idx')
    .on('audit_logs')
    .columns(['entity_type', 'entity_id', 'created_at'])
    .execute();

  await db.schema
    .createIndex('audit_logs_actor_id_idx')
    .on('audit_logs')
    .columns(['actor_id'])
    .execute();

  for (const table of ['asset_events', 'audit_logs']) {
    await sql`
      create trigger ${sql.raw(table)}_append_only
      before update or delete on ${sql.table(table)}
      for each row execute function reject_mutation()
    `.execute(db);
  }
}

export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('audit_logs').ifExists().cascade().execute();
  await db.schema.dropTable('asset_events').ifExists().cascade().execute();
}
