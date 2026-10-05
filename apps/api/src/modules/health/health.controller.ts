import { toApiResponse } from '@inventory/shared';
import { type RequestHandler } from 'express';
import { getHealth, getReadiness } from './health.service.js';

export const getHealthHandler: RequestHandler = (_req, res) => {
  res.status(200).json(toApiResponse(getHealth()));
};

export const getReadinessHandler: RequestHandler = (_req, res, next) => {
  getReadiness()
    .then((readiness) => {
      // 503 so an orchestrator stops sending traffic here while the database is down.
      res.status(readiness.status === 'ready' ? 200 : 503).json(toApiResponse(readiness));
    })
    .catch(next);
};
