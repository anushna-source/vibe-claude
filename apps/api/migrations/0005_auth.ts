import { sql, type Kysely } from 'kysely';

/**
 * Refresh sessions. Only the hash of a refresh token is stored, so a database
 * leak does not hand over working sessions.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrations run before the Database type exists
type Db = Kysely<any>;

export async function up(db: Db): Promise<void> {
  await db.schema
    .createTable('refresh_sessions')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    // sha-256 of the opaque token; the raw value is never stored.
    .addColumn('token_hash', 'text', (c) => c.notNull())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('revoked_at', 'timestamptz')
    // Set when this token is rotated, so reuse of the old one is detectable.
    .addColumn('replaced_by', 'uuid', (c) =>
      c.references('refresh_sessions.id').onDelete('set null'),
    )
    .addColumn('user_agent', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('refresh_sessions_token_hash_unique')
    .on('refresh_sessions')
    .column('token_hash')
    .unique()
    .execute();

  await db.schema
    .createIndex('refresh_sessions_user_id_idx')
    .on('refresh_sessions')
    .columns(['user_id'])
    .execute();

  // Finding the live sessions to revoke when a stolen token is detected.
  await db.schema
    .createIndex('refresh_sessions_live_idx')
    .on('refresh_sessions')
    .columns(['user_id', 'expires_at'])
    .where(sql.ref('revoked_at'), 'is', null)
    .execute();
}

export async function down(db: Db): Promise<void> {
  await db.schema.dropTable('refresh_sessions').ifExists().cascade().execute();
}
