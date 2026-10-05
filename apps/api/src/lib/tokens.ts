import { createHash, randomBytes } from 'node:crypto';
import { userRoleSchema, type UserRole } from '@inventory/shared';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { env } from '../config/env.js';

/**
 * Access tokens are short-lived JWTs sent as a bearer header. Refresh tokens are
 * opaque random strings: only their SHA-256 hash is stored, so a database leak
 * does not hand over working sessions.
 */

const ISSUER = 'inventory-api';
const AUDIENCE = 'inventory-web';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenClaims {
  userId: string;
  role: UserRole;
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  role: userRoleSchema,
});

export function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** Returns null for anything not currently valid: expired, tampered, or foreign. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
    const parsed = claimsSchema.safeParse(payload);

    return parsed.success ? { userId: parsed.data.sub, role: parsed.data.role } : null;
  } catch {
    return null;
  }
}

export interface RefreshToken {
  /** Returned to the client once, then never again. */
  token: string;
  /** What gets stored. */
  hash: string;
  expiresAt: Date;
}

export function createRefreshToken(now: Date = new Date()): RefreshToken {
  const token = randomBytes(48).toString('base64url');
  const expiresAt = new Date(now.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  return { token, hash: hashRefreshToken(token), expiresAt };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
