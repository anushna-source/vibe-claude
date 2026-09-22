import { environmentSchema } from '@inventory/shared';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
export type LogLevel = z.infer<typeof logLevelSchema>;

const envSchema = z.object({
  NODE_ENV: environmentSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: logLevelSchema.default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JSON_BODY_LIMIT: z.string().min(1).default('100kb'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  APP_VERSION: z.string().min(1).default('1.0.0'),
});

export type Env = z.infer<typeof envSchema> & { readonly corsOrigins: readonly string[] };

/**
 * Parses and validates configuration. Exported separately from `env` so it can be
 * unit tested without mutating the real process environment.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const corsOrigins = result.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return { ...result.data, corsOrigins };
}

/** Fails fast at import time if the environment is misconfigured. */
export const env: Env = parseEnv();
