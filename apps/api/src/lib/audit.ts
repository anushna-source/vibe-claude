import type { Transaction } from 'kysely';
import type { Database } from '../db/types.js';

/**
 * AGENTS.md rule 8: every mutation writes an audit row with actor, entity and
 * before/after. Always called inside the same transaction as the write, so a
 * rolled-back change cannot leave an audit entry claiming it happened.
 */
export interface AuditEntry {
  actorId: string | null;
  /** Dotted verb, e.g. location.create. */
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | undefined;
}

export async function writeAudit(trx: Transaction<Database>, entry: AuditEntry): Promise<void> {
  await trx
    .insertInto('audit_logs')
    .values({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
      request_id: entry.requestId ?? null,
    })
    .execute();
}
