import { sql, type Kysely } from 'kysely';

/**
 * Who uses the system (users) and what assets are attached to
 * (departments, locations, categories, staff).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrations run before the Database type exists
type Db = Kysely<any>;

/** Soft deletes only: unique values are freed when a row is soft deleted (rule 5). */
async function uniqueWhenLive(db: Db, table: string, column: string, name: string): Promise<void> {
  await db.schema
    .createIndex(name)
    .on(table)
    .column(column)
    .unique()
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();
}

async function addUpdatedAtTrigger(db: Db, table: string): Promise<void> {
  await sql`
    create trigger ${sql.raw(table)}_set_updated_at
    before update on ${sql.table(table)}
    for each row execute function set_updated_at()
  `.execute(db);
}

export async function up(db: Db): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', sql`citext`, (c) => c.notNull())
    .addColumn('full_name', 'text', (c) => c.notNull())
    // Accounts are created by an Admin; there is no self-registration path.
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('role', sql`user_role`, (c) => c.notNull().defaultTo('viewer'))
    .addColumn('is_active', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('last_login_at', 'timestamptz')
    // Null for the first admin, which is seeded rather than created by someone.
    .addColumn('created_by', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .addCheckConstraint('users_email_not_blank', sql`length(trim(email::text)) > 0`)
    .execute();

  await db.schema
    .createTable('departments')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('locations')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('type', sql`location_type`, (c) => c.notNull())
    .addColumn('building', 'text')
    .addColumn('floor', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('categories')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (c) => c.notNull())
    // The CATEGORY part of an asset tag: BI-<CODE>-<NNNN> (rule 1).
    .addColumn('code', 'text', (c) => c.notNull())
    // Handed out under a row lock so concurrent inserts cannot mint the same tag.
    .addColumn('next_tag_number', 'integer', (c) => c.notNull().defaultTo(1))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .addCheckConstraint('categories_code_format', sql`code ~ '^[A-Z]{2,6}$'`)
    .addCheckConstraint('categories_next_tag_number_positive', sql`next_tag_number > 0`)
    .execute();

  await db.schema
    .createTable('staff')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('employee_code', 'text', (c) => c.notNull())
    .addColumn('full_name', 'text', (c) => c.notNull())
    .addColumn('email', sql`citext`)
    .addColumn('phone', 'text')
    .addColumn('designation', 'text')
    .addColumn('department_id', 'uuid', (c) => c.references('departments.id').onDelete('restrict'))
    .addColumn('status', sql`staff_status`, (c) => c.notNull().defaultTo('active'))
    .addColumn('joined_on', 'date')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await uniqueWhenLive(db, 'users', 'email', 'users_email_unique_live');
  await uniqueWhenLive(db, 'departments', 'name', 'departments_name_unique_live');
  await uniqueWhenLive(db, 'locations', 'name', 'locations_name_unique_live');
  await uniqueWhenLive(db, 'categories', 'code', 'categories_code_unique_live');
  await uniqueWhenLive(db, 'categories', 'name', 'categories_name_unique_live');
  await uniqueWhenLive(db, 'staff', 'employee_code', 'staff_employee_code_unique_live');

  // Lists exclude soft-deleted rows by default, so index for that access pattern.
  await db.schema
    .createIndex('staff_department_id_idx')
    .on('staff')
    .columns(['department_id'])
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  for (const table of ['users', 'departments', 'locations', 'categories', 'staff']) {
    await addUpdatedAtTrigger(db, table);
  }
}

export async function down(db: Db): Promise<void> {
  for (const table of ['staff', 'categories', 'locations', 'departments', 'users']) {
    await db.schema.dropTable(table).ifExists().cascade().execute();
  }
}
