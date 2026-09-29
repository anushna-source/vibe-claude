/**
 * Reference data plus, optionally, the first Admin. Safe to run repeatedly.
 * Registration is open, so anyone can sign up as a Viewer; the seeded Admin is
 * the only account that starts with administrative rights.
 */
import type { LocationType } from '@inventory/shared';
import { env } from '../config/env.js';
import { hashPassword } from '../lib/password.js';
import { closeDb, db } from './client.js';

const DEPARTMENTS = [
  'Administration',
  'Academics',
  'IT',
  'Accounts',
  'Marketing',
  'Student Services',
];

const LOCATIONS: { name: string; type: LocationType; building?: string; floor?: string }[] = [
  { name: 'Head Office', type: 'office', building: 'Main', floor: '1' },
  { name: 'Server Room', type: 'server_room', building: 'Main', floor: '1' },
  { name: 'Lab 1', type: 'lab', building: 'Main', floor: '2' },
  { name: 'Lab 2', type: 'lab', building: 'Main', floor: '2' },
  { name: 'Classroom A', type: 'classroom', building: 'Main', floor: '3' },
  { name: 'Classroom B', type: 'classroom', building: 'Main', floor: '3' },
  { name: 'Store', type: 'store', building: 'Main', floor: '1' },
];

const CATEGORIES = [
  { code: 'LAP', name: 'Laptop' },
  { code: 'DSK', name: 'Desktop' },
  { code: 'PRJ', name: 'Projector' },
  { code: 'DSP', name: 'Display' },
  { code: 'NET', name: 'Networking' },
  { code: 'PER', name: 'Peripheral' },
  { code: 'PHN', name: 'Phone' },
];

export async function seed(): Promise<{
  departments: number;
  locations: number;
  categories: number;
}> {
  // Unique indexes are partial (WHERE deleted_at IS NULL), so onConflict cannot
  // target them directly; check for a live row instead. Seeding is not hot.
  let departments = 0;
  let locations = 0;
  let categories = 0;

  for (const name of DEPARTMENTS) {
    const existing = await db
      .selectFrom('departments')
      .select('id')
      .where('name', '=', name)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) {
      await db.insertInto('departments').values({ name }).execute();
      departments += 1;
    }
  }

  for (const location of LOCATIONS) {
    const existing = await db
      .selectFrom('locations')
      .select('id')
      .where('name', '=', location.name)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) {
      await db.insertInto('locations').values(location).execute();
      locations += 1;
    }
  }

  for (const category of CATEGORIES) {
    const existing = await db
      .selectFrom('categories')
      .select('id')
      .where('code', '=', category.code)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) {
      await db.insertInto('categories').values(category).execute();
      categories += 1;
    }
  }

  return { departments, locations, categories };
}

/**
 * Creates the first Admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Skipped when either is unset or the account already exists, and the password
 * is never printed.
 */
export async function seedAdmin(): Promise<'created' | 'exists' | 'skipped'> {
  const email = env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = env.SEED_ADMIN_PASSWORD;

  if (!email || !password) return 'skipped';

  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', email)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (existing) return 'exists';

  await db
    .insertInto('users')
    .values({
      email,
      full_name: 'Administrator',
      password_hash: await hashPassword(password),
      role: 'admin',
      is_active: true,
    })
    .execute();

  return 'created';
}

const inserted = await seed();
const adminOutcome = await seedAdmin();
// eslint-disable-next-line no-console -- this is a CLI, not the server
console.log(
  `Seed complete. Inserted ${inserted.departments} departments, ${inserted.locations} locations, ${inserted.categories} categories.`,
);
// eslint-disable-next-line no-console -- this is a CLI, not the server
console.log(
  {
    created: 'Admin user created from SEED_ADMIN_EMAIL.',
    exists: 'Admin user already exists; left alone.',
    skipped: 'No admin seeded: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.',
  }[adminOutcome],
);
await closeDb();
