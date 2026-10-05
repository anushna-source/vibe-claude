import { sql, type Kysely } from 'kysely';

/**
 * Assets and their assignments, with AGENTS.md rules 1, 2, 6 and 7 enforced by
 * the database rather than by application code.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrations run before the Database type exists
type Db = Kysely<any>;

export async function up(db: Db): Promise<void> {
  await db.schema
    .createTable('assets')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    // Immutable once written (rule 1); format BI-<CODE>-<NNNN>.
    .addColumn('asset_tag', 'text', (c) => c.notNull())
    .addColumn('category_id', 'uuid', (c) =>
      c.notNull().references('categories.id').onDelete('restrict'),
    )
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('manufacturer', 'text')
    .addColumn('model', 'text')
    .addColumn('serial_number', 'text')
    .addColumn('status', sql`asset_status`, (c) => c.notNull().defaultTo('in_stock'))
    .addColumn('condition', sql`asset_condition`, (c) => c.notNull().defaultTo('good'))
    .addColumn('purchase_date', 'date')
    // NPR, never float (rule 7).
    .addColumn('purchase_price', sql`numeric(14, 2)`)
    .addColumn('vendor', 'text')
    .addColumn('warranty_expires_on', 'date')
    .addColumn('notes', 'text')
    // Set by the assignment service inside the same transaction as the assignment.
    .addColumn('current_assignment_id', 'uuid')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .addCheckConstraint('assets_tag_format', sql`asset_tag ~ '^BI-[A-Z]{2,6}-[0-9]{4,}$'`)
    .addCheckConstraint(
      'assets_purchase_price_non_negative',
      sql`purchase_price is null or purchase_price >= 0`,
    )
    .execute();

  await db.schema
    .createTable('assignments')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('asset_id', 'uuid', (c) => c.notNull().references('assets.id').onDelete('restrict'))
    .addColumn('assignee_type', sql`assignee_type`, (c) => c.notNull())
    .addColumn('staff_id', 'uuid', (c) => c.references('staff.id').onDelete('restrict'))
    .addColumn('location_id', 'uuid', (c) => c.references('locations.id').onDelete('restrict'))
    .addColumn('assigned_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('assigned_by', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('returned_at', 'timestamptz')
    .addColumn('returned_by', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    // Rule 6: a person OR a location, never both and never neither.
    .addCheckConstraint(
      'assignments_assignee_exclusive',
      sql`(assignee_type = 'staff' and staff_id is not null and location_id is null)
          or (assignee_type = 'location' and location_id is not null and staff_id is null)`,
    )
    .addCheckConstraint(
      'assignments_returned_after_assigned',
      sql`returned_at is null or returned_at >= assigned_at`,
    )
    .execute();

  await db.schema
    .alterTable('assets')
    .addForeignKeyConstraint(
      'assets_current_assignment_id_fkey',
      ['current_assignment_id'],
      'assignments',
      ['id'],
    )
    .onDelete('set null')
    .execute();

  await db.schema
    .createIndex('assets_asset_tag_unique_live')
    .on('assets')
    .column('asset_tag')
    .unique()
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('assets_serial_number_unique_live')
    .on('assets')
    .column('serial_number')
    .unique()
    .where(sql`serial_number is not null and deleted_at is null`)
    .execute();

  // Rule 2: exactly one live assignment per asset. Enforced here, never worked
  // around in application code.
  await sql`
    create unique index assignments_one_live_per_asset
      on assignments (asset_id)
      where returned_at is null and deleted_at is null
  `.execute(db);

  // Asset lists will grow past 1,500 rows and are filtered by status/category.
  await db.schema
    .createIndex('assets_status_idx')
    .on('assets')
    .columns(['status'])
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('assets_category_id_idx')
    .on('assets')
    .columns(['category_id'])
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('assignments_asset_id_idx')
    .on('assignments')
    .columns(['asset_id'])
    .execute();

  await db.schema
    .createIndex('assignments_staff_id_idx')
    .on('assignments')
    .columns(['staff_id'])
    .where(sql`staff_id is not null`)
    .execute();

  // Rule 1: the tag is generated server-side and never edited afterwards.
  await sql`
    create or replace function reject_asset_tag_change() returns trigger as $$
    begin
      if new.asset_tag is distinct from old.asset_tag then
        raise exception 'asset_tag is immutable (was %, got %)', old.asset_tag, new.asset_tag
          using errcode = 'restrict_violation';
      end if;
      return new;
    end;
    $$ language plpgsql
  `.execute(db);

  await sql`
    create trigger assets_asset_tag_immutable
    before update on assets
    for each row execute function reject_asset_tag_change()
  `.execute(db);

  for (const table of ['assets', 'assignments']) {
    await sql`
      create trigger ${sql.raw(table)}_set_updated_at
      before update on ${sql.table(table)}
      for each row execute function set_updated_at()
    `.execute(db);
  }
}

export async function down(db: Db): Promise<void> {
  await sql`drop trigger if exists assets_asset_tag_immutable on assets`.execute(db);
  await sql`drop function if exists reject_asset_tag_change()`.execute(db);
  await db.schema.dropTable('assignments').ifExists().cascade().execute();
  await db.schema.dropTable('assets').ifExists().cascade().execute();
}
