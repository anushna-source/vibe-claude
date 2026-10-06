import type { Location, PaginationMeta } from '@inventory/shared';
import type { Kysely } from 'kysely';
import { db as defaultDb, withTransaction } from '../../db/client.js';
import type { Database, Location as LocationRow } from '../../db/types.js';
import { AppError } from '../../lib/app-error.js';
import { writeAudit } from '../../lib/audit.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import type {
  CreateLocationInput,
  LocationListQuery,
  UpdateLocationInput,
} from './locations.schema.js';

const ENTITY = 'location';

function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    building: row.building,
    floor: row.floor,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const duplicate = (): AppError => AppError.conflict('A location with that name already exists');

/** Optional text fields are stored as null rather than an empty string. */
function nullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.length === 0 ? null : value;
}

export async function listLocations(
  query: LocationListQuery,
  database: Kysely<Database> = defaultDb,
): Promise<{ data: Location[]; meta: PaginationMeta }> {
  let base = database.selectFrom('locations').where('deleted_at', 'is', null);

  if (query.q) {
    const term = `%${query.q}%`;
    base = base.where((eb) => eb.or([eb('name', 'ilike', term), eb('building', 'ilike', term)]));
  }

  if (query.type) {
    base = base.where('type', '=', query.type);
  }

  const rows = await base
    .selectAll()
    .orderBy('name', 'asc')
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .execute();

  const counted = await base
    .select((eb) => eb.fn.countAll<number>().as('total'))
    .executeTakeFirstOrThrow();

  return {
    data: rows.map(toLocation),
    meta: { page: query.page, limit: query.limit, total: Number(counted.total) },
  };
}

export async function createLocation(
  input: CreateLocationInput,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<Location> {
  return withTransaction(async (trx) => {
    let row: LocationRow;

    try {
      row = await trx
        .insertInto('locations')
        .values({
          name: input.name,
          type: input.type,
          building: nullable(input.building) ?? null,
          floor: nullable(input.floor) ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate();
      throw error;
    }

    await writeAudit(trx, {
      actorId,
      action: `${ENTITY}.create`,
      entityType: ENTITY,
      entityId: row.id,
      after: { name: row.name, type: row.type },
      requestId,
    });

    return toLocation(row);
  }, database);
}

export async function updateLocation(
  id: string,
  input: UpdateLocationInput,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<Location> {
  return withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('locations')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) throw AppError.notFound('Location not found');

    let row: LocationRow;

    try {
      row = await trx
        .updateTable('locations')
        .set({
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.building === undefined ? {} : { building: nullable(input.building) ?? null }),
          ...(input.floor === undefined ? {} : { floor: nullable(input.floor) ?? null }),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate();
      throw error;
    }

    await writeAudit(trx, {
      actorId,
      action: `${ENTITY}.update`,
      entityType: ENTITY,
      entityId: id,
      before: { name: existing.name, type: existing.type },
      after: { name: row.name, type: row.type },
      requestId,
    });

    return toLocation(row);
  }, database);
}

export async function deleteLocation(
  id: string,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<void> {
  await withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('locations')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) throw AppError.notFound('Location not found');

    // Equipment assigned to a room would otherwise point at nothing.
    const inUse = await trx
      .selectFrom('assignments')
      .select((eb) => eb.fn.countAll<number>().as('total'))
      .where('location_id', '=', id)
      .where('deleted_at', 'is', null)
      .where('returned_at', 'is', null)
      .executeTakeFirstOrThrow();

    const assetCount = Number(inUse.total);
    if (assetCount > 0) {
      throw AppError.conflict(
        `${existing.name} still holds ${assetCount} asset${assetCount === 1 ? '' : 's'}. Return or transfer them first.`,
        { assetCount },
      );
    }

    await trx
      .updateTable('locations')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .execute();

    await writeAudit(trx, {
      actorId,
      action: `${ENTITY}.delete`,
      entityType: ENTITY,
      entityId: id,
      before: { name: existing.name, type: existing.type },
      requestId,
    });
  }, database);
}
