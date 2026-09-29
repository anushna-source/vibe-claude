import type { AuthUser, LoginInput, SignupInput } from '@inventory/shared';
import type { Kysely, Transaction } from 'kysely';
import { env } from '../../config/env.js';
import { db as defaultDb, withTransaction } from '../../db/client.js';
import type { Database, User } from '../../db/types.js';
import { AppError } from '../../lib/app-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  type RefreshToken,
} from '../../lib/tokens.js';

/**
 * All business logic lives here; controllers only parse and respond.
 * Anything that creates or ends a session also writes an audit row (rule 8).
 */

export interface SessionResult {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface SessionContext {
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

/** Maps a database row to the API shape. password_hash never crosses this line. */
export function toAuthUser(row: User): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  };
}

async function writeAudit(
  trx: Transaction<Database>,
  entry: {
    actorId: string | null;
    action: string;
    entityId: string;
    after?: unknown;
    before?: unknown;
    requestId?: string | undefined;
  },
): Promise<void> {
  await trx
    .insertInto('audit_logs')
    .values({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: 'user',
      entity_id: entry.entityId,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
      request_id: entry.requestId ?? null,
    })
    .execute();
}

async function issueSession(
  trx: Transaction<Database>,
  user: User,
  context: SessionContext,
): Promise<SessionResult> {
  const refresh: RefreshToken = createRefreshToken();

  await trx
    .insertInto('refresh_sessions')
    .values({
      user_id: user.id,
      token_hash: refresh.hash,
      expires_at: refresh.expiresAt,
      user_agent: context.userAgent ?? null,
    })
    .execute();

  const accessToken = await signAccessToken({ userId: user.id, role: user.role });

  return {
    user: toAuthUser(user),
    accessToken,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
}

/**
 * Registration is open (AGENTS.md): anyone may sign up, and the account is an
 * active Viewer straight away. Role and status are never taken from the request.
 */
export async function signup(
  input: SignupInput,
  context: SessionContext = {},
  database: Kysely<Database> = defaultDb,
): Promise<SessionResult> {
  return withTransaction(async (trx) => {
    const existing = await trx
      .selectFrom('users')
      .select('id')
      .where('email', '=', input.email)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (existing) {
      throw AppError.conflict('An account with that email already exists');
    }

    const user = await trx
      .insertInto('users')
      .values({
        email: input.email,
        full_name: input.fullName,
        password_hash: await hashPassword(input.password),
        role: 'viewer',
        is_active: true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAudit(trx, {
      actorId: user.id,
      action: 'user.signup',
      entityId: user.id,
      after: { email: user.email, role: user.role },
      requestId: context.requestId,
    });

    return issueSession(trx, user, context);
  }, database);
}

export async function login(
  input: LoginInput,
  context: SessionContext = {},
  database: Kysely<Database> = defaultDb,
): Promise<SessionResult> {
  const user = await database
    .selectFrom('users')
    .selectAll()
    .where('email', '=', input.email)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  // One message for every failure: a different one for an unknown email would
  // let anyone enumerate who has an account.
  const invalid = AppError.unauthorized('Email or password is incorrect');

  if (!user) {
    // Still hash, so a missing account does not answer measurably faster.
    await hashPassword(input.password);
    throw invalid;
  }

  if (!(await verifyPassword(input.password, user.password_hash))) {
    throw invalid;
  }

  if (!user.is_active) {
    throw AppError.forbidden('This account has been deactivated');
  }

  return withTransaction(async (trx) => {
    const updated = await trx
      .updateTable('users')
      .set({ last_login_at: new Date() })
      .where('id', '=', user.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAudit(trx, {
      actorId: user.id,
      action: 'user.login',
      entityId: user.id,
      requestId: context.requestId,
    });

    return issueSession(trx, updated, context);
  }, database);
}

/**
 * Rotates the pair. Presenting a token that was already rotated means it leaked,
 * so every live session for that user is revoked.
 */
export async function refresh(
  rawToken: string,
  context: SessionContext = {},
  database: Kysely<Database> = defaultDb,
): Promise<SessionResult> {
  const tokenHash = hashRefreshToken(rawToken);
  const expired = AppError.unauthorized('Your session has expired, please sign in again');

  const session = await database
    .selectFrom('refresh_sessions')
    .selectAll()
    .where('token_hash', '=', tokenHash)
    .executeTakeFirst();

  if (!session) throw expired;

  if (session.revoked_at !== null) {
    // Reuse of a rotated token: assume theft and end every session. This has to
    // commit in its own transaction — doing it in the one we then throw from
    // would roll the revocation straight back.
    await withTransaction(async (trx) => {
      await trx
        .updateTable('refresh_sessions')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', session.user_id)
        .where('revoked_at', 'is', null)
        .execute();

      await writeAudit(trx, {
        actorId: session.user_id,
        action: 'auth.refresh_reuse_detected',
        entityId: session.user_id,
        requestId: context.requestId,
      });
    }, database);

    throw expired;
  }

  if (session.expires_at.getTime() <= Date.now()) throw expired;

  return withTransaction(async (trx) => {
    // Re-read under a row lock so two refreshes racing on the same token cannot
    // both rotate it.
    const locked = await trx
      .selectFrom('refresh_sessions')
      .selectAll()
      .where('id', '=', session.id)
      .forUpdate()
      .executeTakeFirst();

    if (!locked || locked.revoked_at !== null) throw expired;

    const user = await trx
      .selectFrom('users')
      .selectAll()
      .where('id', '=', session.user_id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (!user) throw expired;
    if (!user.is_active) throw AppError.forbidden('This account has been deactivated');

    const issued = await issueSession(trx, user, context);

    const replacement = await trx
      .selectFrom('refresh_sessions')
      .select('id')
      .where('token_hash', '=', hashRefreshToken(issued.refreshToken))
      .executeTakeFirstOrThrow();

    await trx
      .updateTable('refresh_sessions')
      .set({ revoked_at: new Date(), replaced_by: replacement.id })
      .where('id', '=', session.id)
      .execute();

    return issued;
  }, database);
}

export async function logout(
  rawToken: string | undefined,
  context: SessionContext = {},
  database: Kysely<Database> = defaultDb,
): Promise<void> {
  if (!rawToken) return;

  const session = await database
    .selectFrom('refresh_sessions')
    .select(['id', 'user_id'])
    .where('token_hash', '=', hashRefreshToken(rawToken))
    .where('revoked_at', 'is', null)
    .executeTakeFirst();

  if (!session) return;

  await withTransaction(async (trx) => {
    await trx
      .updateTable('refresh_sessions')
      .set({ revoked_at: new Date() })
      .where('id', '=', session.id)
      .execute();

    await writeAudit(trx, {
      actorId: session.user_id,
      action: 'user.logout',
      entityId: session.user_id,
      requestId: context.requestId,
    });
  }, database);
}

export async function getUserById(
  id: string,
  database: Kysely<Database> = defaultDb,
): Promise<AuthUser | null> {
  const user = await database
    .selectFrom('users')
    .selectAll()
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  return user ? toAuthUser(user) : null;
}
