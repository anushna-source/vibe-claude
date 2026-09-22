import { pino, type LoggerOptions } from 'pino';
import { env } from '../config/env.js';

/**
 * Nothing secret or personally identifying may reach the logs (AGENTS.md).
 * These paths are redacted before anything is written.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.licenseKey',
];

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: 'api', environment: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
};

export const logger =
  env.NODE_ENV === 'development'
    ? pino({
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      })
    : pino(baseOptions);
