import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';
import { REQUEST_ID_HEADER } from './request-id.js';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    const header = req.headers[REQUEST_ID_HEADER];
    return typeof header === 'string' ? header : randomUUID();
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
