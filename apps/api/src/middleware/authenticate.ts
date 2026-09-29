import type { UserRole } from '@inventory/shared';
import type { RequestHandler, Response } from 'express';
import { AppError } from '../lib/app-error.js';
import { verifyAccessToken } from '../lib/tokens.js';

/**
 * Authentication and authorization are enforced here, on the server. Hiding a
 * button in the UI is not authorization (AGENTS.md).
 */

export interface CurrentUser {
  userId: string;
  role: UserRole;
}

const CURRENT_USER_KEY = 'currentUser';

/** Rejects anything without a valid, unexpired bearer token. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.get('authorization');

  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  verifyAccessToken(token)
    .then((claims) => {
      if (!claims) {
        next(AppError.unauthorized());
        return;
      }

      res.locals[CURRENT_USER_KEY] = claims;
      next();
    })
    .catch(next);
};

/** Reads the caller established by requireAuth. */
export function getCurrentUser(res: Response): CurrentUser | undefined {
  const value: unknown = res.locals[CURRENT_USER_KEY];

  if (typeof value !== 'object' || value === null) return undefined;

  const candidate = value as Partial<CurrentUser>;
  return typeof candidate.userId === 'string' && typeof candidate.role === 'string'
    ? { userId: candidate.userId, role: candidate.role }
    : undefined;
}

/** For handlers mounted behind requireAuth, where a missing user is a bug. */
export function requireUser(res: Response): CurrentUser {
  const user = getCurrentUser(res);

  if (!user) {
    throw new Error('requireAuth middleware did not run for this route');
  }

  return user;
}
