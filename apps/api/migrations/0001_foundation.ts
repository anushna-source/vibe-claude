import { sql, type Kysely } from 'kysely';

/**
 * Extensions, shared enums, and the updated_at trigger function every table uses.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrations run before the Database type exists
type Db = Kysely<any>;

const ENUMS = {
  user_role: ['admin', 'it_staff', 'viewer'],
  staff_status: ['active', 'on_leave', 'left'],
  location_type: ['office', 'lab', 'classroom', 'server_room', 'store'],
  asset_status: ['in_stock', 'assigned', 'in_repair', 'retired', 'disposed', 'lost'],
  asset_condition: ['new', 'good', 'fair', 'poor', 'damaged'],
  assignee_type: ['staff', 'location'],
  asset_event_type: [
    'created',
    'updated',
    'assigned',
    'returned',
    'transferred',
    'status_changed',
    'repair_started',
    'repair_completed',
    'retired',
    'disposed',
    'lost',
  ],
} as const;

export async function up(db: Db): Promise<void> {
  // gen_random_uuid() for primary keys; citext for case-insensitive emails.
  // Extensions are per database, so they go in public and are never dropped by
  // `down` — the test harness migrates inside its own schema and relies on them.
  await sql`create extension if not exists "pgcrypto" with schema public`.execute(db);
  await sql`create extension if not exists "citext" with schema public`.execute(db);

  for (const [name, values] of Object.entries(ENUMS)) {
    await db.schema
      .createType(name)
      .asEnum(values as unknown as string[])
      .execute();
  }

  // Keeps updated_at honest: the application cannot forget to set it.
  await sql`
    create or replace function set_updated_at() returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql
  `.execute(db);

  // Used by asset_events and audit_logs, which are append-only (AGENTS.md rule 4).
  await sql`
    create or replace function reject_mutation() returns trigger as $$
    begin
      raise exception '% is append-only; % is not allowed', tg_table_name, tg_op
        using errcode = 'restrict_violation';
    end;
    $$ language plpgsql
  `.execute(db);
}

export async function down(db: Db): Promise<void> {
  await sql`drop function if exists reject_mutation()`.execute(db);
  await sql`drop function if exists set_updated_at()`.execute(db);

  for (const name of Object.keys(ENUMS)) {
    await db.schema.dropType(name).ifExists().execute();
  }
}
