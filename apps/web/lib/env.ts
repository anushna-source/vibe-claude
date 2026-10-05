import { z } from 'zod';

/**
 * Configuration, validated the same way the API validates its own
 * (apps/api/src/config/env.ts). The parse functions are exported separately so
 * they can be unit tested without touching the real process environment.
 */

const serverSchema = z.object({
  API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),
  API_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(8_000),
});

const clientSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function fail(scope: string, error: z.ZodError): never {
  const details = error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid ${scope} configuration: ${details}`);
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  return result.success ? result.data : fail('server', result.error);
}

export function parseClientEnv(source: Record<string, string | undefined>): ClientEnv {
  const result = clientSchema.safeParse(source);
  return result.success ? result.data : fail('client', result.error);
}

// Next inlines NEXT_PUBLIC_* at build time only when referenced literally, so
// this cannot be written as a dynamic lookup.
const clientEnv = parseClientEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

const isServer = typeof window === 'undefined';

const serverEnv = isServer
  ? parseServerEnv({
      API_BASE_URL: process.env.API_BASE_URL,
      API_REQUEST_TIMEOUT_MS: process.env.API_REQUEST_TIMEOUT_MS,
    })
  : undefined;

/** The API origin to call from wherever this code is currently running. */
export function apiBaseUrl(): string {
  return serverEnv ? serverEnv.API_BASE_URL : clientEnv.NEXT_PUBLIC_API_BASE_URL;
}

export function apiTimeoutMs(): number {
  return serverEnv ? serverEnv.API_REQUEST_TIMEOUT_MS : 8_000;
}
