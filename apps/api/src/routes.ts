import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';

/** Everything is mounted under /api/v1 (AGENTS.md). */
export const apiV1Router: Router = Router();

apiV1Router.use('/health', healthRouter);
