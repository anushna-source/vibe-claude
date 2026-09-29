import { z } from 'zod';

/** ISO 8601 UTC instant, e.g. 2026-09-21T04:12:55.123Z. Dates are stored UTC (AGENTS.md). */
const ISO_UTC_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export const environmentSchema = z.enum(['development', 'test', 'production']);
export type Environment = z.infer<typeof environmentSchema>;

export const healthStatusSchema = z.enum(['ok', 'degraded']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthSchema = z.object({
  status: healthStatusSchema,
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().regex(ISO_UTC_DATETIME),
  version: z.string().min(1),
  environment: environmentSchema,
});
export type Health = z.infer<typeof healthSchema>;

export const healthResponseSchema = z.object({ data: healthSchema });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Readiness: is this instance able to serve traffic right now? */
export const readinessSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({
    database: z.enum(['up', 'down']),
  }),
  timestamp: z.string().regex(ISO_UTC_DATETIME),
});
export type Readiness = z.infer<typeof readinessSchema>;

export const readinessResponseSchema = z.object({ data: readinessSchema });
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
