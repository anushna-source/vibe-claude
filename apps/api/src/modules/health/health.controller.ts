import { toApiResponse } from '@inventory/shared';
import { type RequestHandler } from 'express';
import { getHealth } from './health.service.js';

export const getHealthHandler: RequestHandler = (_req, res) => {
  res.status(200).json(toApiResponse(getHealth()));
};
