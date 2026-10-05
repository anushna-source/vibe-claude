import type { UserRole } from '@inventory/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/app-error.js';
import { getCurrentUser } from './authenticate.js';

/**
 * Role check, always mounted after requireAuth. A caller with no session gets
 * 401; a caller with the wrong role gets 403.
 */
export function requireRole(...roles: readonly UserRole[]): RequestHandler {
  return (_req, res, next) => {
    const user = getCurrentUser(res);

    if (!user) {
      next(AppError.unauthorized());
      return;
    }

    if (!roles.includes(user.role)) {
      next(AppError.forbidden());
      return;
    }

    next();
  };
}
