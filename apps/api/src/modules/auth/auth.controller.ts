import { toApiResponse } from '@inventory/shared';
import type { CookieOptions, RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { getRequestId } from '../../middleware/request-id.js';
import { requireUser } from '../../middleware/authenticate.js';
import { validated } from '../../middleware/validate.js';
import type { LoginInput, SignupInput } from './auth.schema.js';
import {
  getUserById,
  login as loginService,
  logout as logoutService,
  refresh as refreshService,
  signup as signupService,
  type SessionResult,
} from './auth.service.js';

export const REFRESH_COOKIE = 'inventory_refresh';

/**
 * The refresh token lives in an httpOnly cookie so page scripts cannot read it.
 * The access token goes in the body, to be sent as a bearer header (AGENTS.md).
 */
function refreshCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/api/v1/auth',
  };
}

function sendSession(
  res: Parameters<RequestHandler>[1],
  result: SessionResult,
  status: number,
): void {
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.refreshExpiresAt));
  res.status(status).json(
    toApiResponse({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    }),
  );
}

function contextFrom(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) {
  return {
    userAgent: req.get('user-agent'),
    requestId: getRequestId(res),
  };
}

export const signupHandler: RequestHandler = (req, res, next) => {
  const { body } = validated<SignupInput>(res);

  signupService(body, contextFrom(req, res))
    .then((result) => {
      sendSession(res, result, 201);
    })
    .catch(next);
};

export const loginHandler: RequestHandler = (req, res, next) => {
  const { body } = validated<LoginInput>(res);

  loginService(body, contextFrom(req, res))
    .then((result) => {
      sendSession(res, result, 200);
    })
    .catch(next);
};

export const refreshHandler: RequestHandler = (req, res, next) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];

  if (typeof token !== 'string' || token.length === 0) {
    next(AppError.unauthorized('Your session has expired, please sign in again'));
    return;
  }

  refreshService(token, contextFrom(req, res))
    .then((result) => {
      sendSession(res, result, 200);
    })
    .catch(next);
};

export const logoutHandler: RequestHandler = (req, res, next) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];

  logoutService(typeof token === 'string' ? token : undefined, contextFrom(req, res))
    .then(() => {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.status(204).end();
    })
    .catch(next);
};

export const meHandler: RequestHandler = (_req, res, next) => {
  const current = requireUser(res);

  getUserById(current.userId)
    .then((user) => {
      if (!user) {
        next(AppError.unauthorized());
        return;
      }
      res.status(200).json(toApiResponse(user));
    })
    .catch(next);
};
