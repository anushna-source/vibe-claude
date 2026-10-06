import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { departmentsRouter } from './modules/departments/departments.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { locationsRouter } from './modules/locations/locations.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

/** Everything is mounted under /api/v1 (AGENTS.md). */
export const apiV1Router: Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', usersRouter);
apiV1Router.use('/departments', departmentsRouter);
apiV1Router.use('/locations', locationsRouter);
apiV1Router.use('/categories', categoriesRouter);
