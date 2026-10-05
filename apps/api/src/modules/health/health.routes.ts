import { Router } from 'express';
import { getHealthHandler, getReadinessHandler } from './health.controller.js';

export const healthRouter: Router = Router();

healthRouter.get('/', getHealthHandler);
healthRouter.get('/ready', getReadinessHandler);
