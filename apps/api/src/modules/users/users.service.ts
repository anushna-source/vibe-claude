import type { AuthUser, PaginationMeta, UpdateUserInput } from '@inventory/shared';
import type { Kysely } from 'kysely';
import { db as defaultDb, withTransaction } from '../../db/client.js';
import type { Database } from '../../db/types.js';
import { AppError } from '../../lib/app-error.js';
import { toAuthUser } from '../auth/auth.service.js';
import type { ListUsersQuery } from './users.schema.js';

/** Admin-only account administration. */

export async function listUsers(
  query: ListUsersQuery,
  database: Kysely<Database> = defaultDb,
): Promise<{ data: AuthUser[]; meta: PaginationMeta }> {
  const offset = (query.page - 1) * query.limit;

  let base = database.selectFrom('users').where('deleted_at', 'is', null);

  if (query.q) {
    const term = `%${query.q}%`;
    base = base.where((eb) => eb.or([eb('email', 'ilike', term), eb('full_name', 'ilike', term)]));
  }

  const rows = await base
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(query.limit)
    .offset(offset)
    .execute();

  const counted = await base
    .select((eb) => eb.fn.countAll<number>().as('total'))
    .executeTakeFirstOrThrow();

  return {
    data: rows.map(toAuthUser),
    meta: { page: query.page, limit: query.limit, total: Number(counted.total) },
  };
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actorId: string,
  requestId: string | undefined,
  database: Kysely<Database> = defaultDb,
): Promise<AuthUser> {
  return withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!existing) throw AppError.notFound('User not found');

    // An admin locking or demoting themselves could leave nobody able to
    // administer the system.
    if (existing.id === actorId) {
      throw AppError.conflict('You cannot change your own role or status');
    }

    const updated = await trx
      .updateTable('users')
      .set({
        ...(input.role === undefined ? {} : { role: input.role }),
        ...(input.isActive === undefined ? {} : { is_active: input.isActive }),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Deactivating someone must end their sessions, not just block new logins.
    if (input.isActive === false) {
      await trx
        .updateTable('refresh_sessions')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', id)
        .where('revoked_at', 'is', null)
        .execute();
    }

    await trx
      .insertInto('audit_logs')
      .values({
        actor_id: actorId,
        action: 'user.update',
        entity_type: 'user',
        entity_id: id,
        before: JSON.stringify({ role: existing.role, isActive: existing.is_active }),
        after: JSON.stringify({ role: updated.role, isActive: updated.is_active }),
        request_id: requestId ?? null,
      })
      .execute();

    return toAuthUser(updated);
  }, database);
}
