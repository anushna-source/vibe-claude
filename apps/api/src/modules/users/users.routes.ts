import { Router } from 'express';
import { requireAuth } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listUsersHandler, updateUserHandler } from './users.controller.js';
import { listUsersQuerySchema, updateUserBodySchema, userIdParamsSchema } from './users.schema.js';

/** Account administration is Admin only, enforced by middleware on the server. */
export const usersRouter: Router = Router();

usersRouter.use(requireAuth, requireRole('admin'));

usersRouter.get('/', validate({ query: listUsersQuerySchema }), listUsersHandler);

usersRouter.patch(
  '/:id',
  validate({ params: userIdParamsSchema, body: updateUserBodySchema }),
  updateUserHandler,
);
