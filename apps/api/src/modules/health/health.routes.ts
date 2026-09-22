import { Router } from 'express';
import { getHealthHandler } from './health.controller.js';

export const healthRouter: Router = Router();

healthRouter.get('/', getHealthHandler);
