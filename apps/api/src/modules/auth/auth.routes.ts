import { loginSchema, signupSchema } from '@inventory/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  signupHandler,
} from './auth.controller.js';

/**
 * Registration is open, so these endpoints are the app's front door: rate limit
 * them or they become an account-spam and password-guessing surface.
 */
const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Tests drive many requests through one app instance.
  skip: () => env.NODE_ENV === 'test',
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
  },
});

export const authRouter: Router = Router();

authRouter.post('/signup', authLimiter, validate({ body: signupSchema }), signupHandler);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), loginHandler);
authRouter.post('/refresh', refreshHandler);
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', requireAuth, meHandler);
