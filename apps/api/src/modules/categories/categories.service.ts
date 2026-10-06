import type { Category, PaginationMeta } from '@inventory/shared';
import type { Kysely, Transaction } from 'kysely';
import { db as defaultDb, withTransaction } from '../../db/client.js';
import type { Category as CategoryRow, Database } from '../../db/types.js';
import { AppError } from '../../lib/app-error.js';
import { writeAudit } from '../../lib/audit.js';
import { isUniqueViolation } from '../../lib/db-errors.js';
import type {
  CategoryListQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './categories.schema.js';

const ENTITY = 'category';

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    nextTagNumber: row.next_tag_number,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function duplicate(error: unknown): AppError {
  return isUniqueViolation(error, 'categories_code_unique_live')
    ? AppError.conflict('A category with that code already exists')
    : AppError.conflict('A category with that name already exists');
}

async function countAssets(trx: Transaction<Database>, categoryId: string): Promise<number> {
  const counted = await trx
    .selectFrom('assets')
    .select((eb) => eb.fn.countAll<number>().as('total'))
    .where('category_id', '=', categoryId)
    .where('deleted_at', 'is', null)
    .executeTakeFirstOrThrow();

  return Number(counted.total);
}

export async function listCategories(
  query: CategoryListQuery,
  database: Kysely<Database> = defaultDb,
): Promise<{ data: Category[]; meta: PaginationMeta }> {
  let base = database.selectFrom('categories').where('deleted_at', 'is', null);

  if (query.q) {
    const term = `%${query.q}%`;
    base = base.where((eb) => eb.or([eb('name', 'ilike', term), eb('code', 'ilike', term)]));
  }

  const rows = await base
    .selectAll()
    .orderBy('code', 'asc')
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
    .execute();

  const counted = await base
    .select((eb) => eb.fn.countAll<number>().as('total'))
    .executeTakeFirstOrThrow();

  return {
    data: rows.map(toCategory),
    meta: { page: query.page, limit: query.limit, total: Number(counted.total) },
  };
}

export async function createCategory(
  input: CreateCategoryInput,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<Category> {
  return withTransaction(async (trx) => {
    let row: CategoryRow;

    try {
      // next_tag_number is never taken from the request; it starts at 1 and only
      // tag generation moves it.
      row = await trx
        .insertInto('categories')
        .values({ name: input.name, code: input.code })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate(error);
      throw error;
    }

    await writeAudit(trx, {
      actorId,
      action: `${ENTITY}.create`,
      entityType: ENTITY,
      entityId: row.id,
      after: { name: row.name, code: row.code },
      requestId,
    });

    return toCategory(row);
  }, database);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<Category> {
  return withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('categories')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) throw AppError.notFound('Category not found');

    // The code is the middle of every asset tag (BI-LAP-0042) and tags are
    // immutable (rule 1), so once a tag has been issued the code must stand.
    if (input.code !== undefined && input.code !== existing.code) {
      const assetCount = await countAssets(trx, id);

      if (assetCount > 0) {
        throw AppError.conflict(
          `The code ${existing.code} is already part of ${assetCount} asset tag${assetCount === 1 ? '' : 's'} and cannot change. Create a new category instead.`,
          { assetCount, code: existing.code },
        );
      }
    }

    let row: CategoryRow;

    try {
      row = await trx
        .updateTable('categories')
        .set({
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.code === undefined ? {} : { code: input.code }),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate(error);
      throw error;
    }

    await writeAudit(trx, {
      actorId,
      action: `${ENTITY}.update`,
      entityType: ENTITY,
      entityId: id,
      before: { name: existing.name, code: existing.code },
      after: { name: row.name, code: row.code },
      requestId,
    });

    return toCategory(row);
  }, database);
}

export async function deleteCategory(
  id: string,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<void> {
  await withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('categories')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) throw AppError.notFound('Category not found');

    const assetCount = await countAssets(trx, id);
    if (assetCount > 0) {
      throw AppError.conflict(
        `${existing.name} still has ${assetCount} asset${assetCount === 1 ? '' : 's'}. Reassign or dispose of them first.`,
        { assetCount },
      );
    }

    await trx
      .updateTable('categories')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .execute();

    await writeAudit(trx, {
      actorId,
      action: `${ENTITY}.delete`,
      entityType: ENTITY,
      entityId: id,
      before: { name: existing.name, code: existing.code },
      requestId,
    });
  }, database);
}
