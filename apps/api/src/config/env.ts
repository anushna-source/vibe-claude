import { environmentSchema } from '@inventory/shared';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

/**
 * Lets development and tests run without configuration. Production refuses to
 * start with it, so a real deployment cannot accidentally sign tokens with a
 * secret that is published in this repository.
 */
const DEV_JWT_SECRET = 'development-only-secret-do-not-use-in-production';
export type LogLevel = z.infer<typeof logLevelSchema>;

const envSchema = z.object({
  NODE_ENV: environmentSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: logLevelSchema.default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JSON_BODY_LIMIT: z.string().min(1).default('100kb'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  APP_VERSION: z.string().min(1).default('1.0.0'),

  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://inventory:inventory@localhost:5432/inventory'),
  // Tests point the app at a throwaway schema so they never touch dev data.
  DB_SCHEMA: z.string().min(1).optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(5_000),

  JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  // Used once by `pnpm db:seed`. Seeding is skipped when either is unset.
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
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

  if (result.data.NODE_ENV === 'production' && result.data.JWT_SECRET === DEV_JWT_SECRET) {
    throw new Error(
      'Invalid environment configuration: JWT_SECRET must be set to a real secret in production',
    );
  }

  const corsOrigins = result.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return { ...result.data, corsOrigins };
}

/** Fails fast at import time if the environment is misconfigured. */
export const env: Env = parseEnv();
