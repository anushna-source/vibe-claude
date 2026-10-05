import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/types.js';
import { hashPassword } from '../../src/lib/password.js';
import { signAccessToken } from '../../src/lib/tokens.js';
import type { UserRole } from '@inventory/shared';

/** Creates a user directly, so tests do not have to sign up to get a role. */
export async function createUser(
  db: Kysely<Database>,
  options: { email: string; password?: string; role?: UserRole; isActive?: boolean },
): Promise<{ id: string; email: string; role: UserRole; accessToken: string }> {
  const role = options.role ?? 'viewer';

  const user = await db
    .insertInto('users')
    .values({
      email: options.email,
      full_name: 'Test User',
      password_hash: await hashPassword(options.password ?? 'correct-horse-battery'),
      role,
      is_active: options.isActive ?? true,
    })
    .returning(['id', 'email', 'role'])
    .executeTakeFirstOrThrow();

  return { ...user, accessToken: await signAccessToken({ userId: user.id, role }) };
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

/** Pulls the refresh cookie out of a supertest response. */
export function refreshCookie(headers: Record<string, unknown>): string | undefined {
  const raw = headers['set-cookie'];
  const cookies = Array.isArray(raw) ? (raw as string[]) : [];
  return cookies.find((cookie) => cookie.startsWith('inventory_refresh='));
}
