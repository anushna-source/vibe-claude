import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { AppError } from './lib/app-error.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiV1Router } from './routes.js';

const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Non-browser callers (curl, server to server) send no Origin header.
    if (origin === undefined || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(AppError.forbidden('Origin not allowed'));
  },
};

/**
 * Builds the app without binding a port, so tests can drive it in process.
 * Binding lives in server.ts.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(requestLogger);

  app.use('/api/v1', apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
