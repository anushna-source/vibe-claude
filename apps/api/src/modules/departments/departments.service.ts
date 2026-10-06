import type { Department, PaginationMeta } from '@inventory/shared';
import type { Kysely } from 'kysely';
import { db as defaultDb, withTransaction } from '../../db/client.js';
import type { Database, Department as DepartmentRow } from '../../db/types.js';
import { AppError } from '../../lib/app-error.js';
import { writeAudit } from '../../lib/audit.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import type {
  CreateDepartmentInput,
  DepartmentListQuery,
  UpdateDepartmentInput,
} from './departments.schema.js';

/** Business logic lives here; the controller only parses and responds. */

const ENTITY = 'department';

function toDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const duplicate = (): AppError => AppError.conflict('A department with that name already exists');

export async function listDepartments(
  query: DepartmentListQuery,
  database: Kysely<Database> = defaultDb,
): Promise<{ data: Department[]; meta: PaginationMeta }> {
  // Soft-deleted rows are excluded by default (rule 5).
  let base = database.selectFrom('departments').where('deleted_at', 'is', null);

  if (query.q) {
    base = base.where('name', 'ilike', `%${query.q}%`);
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
    data: rows.map(toDepartment),
    meta: { page: query.page, limit: query.limit, total: Number(counted.total) },
  };
}

export async function createDepartment(
  input: CreateDepartmentInput,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<Department> {
  return withTransaction(async (trx) => {
    let row: DepartmentRow;

    try {
      row = await trx
        .insertInto('departments')
        .values({ name: input.name })
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
      after: { name: row.name },
      requestId,
    });

    return toDepartment(row);
  }, database);
}

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<Department> {
  return withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('departments')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) throw AppError.notFound('Department not found');

    let row: DepartmentRow;

    try {
      row = await trx
        .updateTable('departments')
        .set({ ...(input.name === undefined ? {} : { name: input.name }) })
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
      before: { name: existing.name },
      after: { name: row.name },
      requestId,
    });

    return toDepartment(row);
  }, database);
}

export async function deleteDepartment(
  id: string,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<void> {
  await withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('departments')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) throw AppError.notFound('Department not found');

    // Refuse with a useful message instead of letting the foreign key fail.
    const inUse = await trx
      .selectFrom('staff')
      .select((eb) => eb.fn.countAll<number>().as('total'))
      .where('department_id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirstOrThrow();

    const staffCount = Number(inUse.total);
    if (staffCount > 0) {
      throw AppError.conflict(
        `${existing.name} still has ${staffCount} staff member${staffCount === 1 ? '' : 's'}. Move them first.`,
        { staffCount },
      );
    }

    await trx
      .updateTable('departments')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .execute();

    await writeAudit(trx, {
      actorId,
      action: `${ENTITY}.delete`,
      entityType: ENTITY,
      entityId: id,
      before: { name: existing.name },
      requestId,
    });
  }, database);
}
