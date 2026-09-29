/**
 * Reference data only, and safe to run repeatedly.
 * The first Admin user is seeded in build step 3, where password hashing lives.
 */
import type { LocationType } from '@inventory/shared';
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

const inserted = await seed();
// eslint-disable-next-line no-console -- this is a CLI, not the server
console.log(
  `Seed complete. Inserted ${inserted.departments} departments, ${inserted.locations} locations, ${inserted.categories} categories.`,
);
await closeDb();
