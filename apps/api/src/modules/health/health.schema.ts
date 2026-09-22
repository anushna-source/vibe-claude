/**
 * The health contract lives in packages/shared so the web app can validate the
 * same shape. It is re-exported here to keep the four-file module layout from
 * AGENTS.md.
 */
export { healthResponseSchema, healthSchema, healthStatusSchema } from '@inventory/shared';
export type { Health, HealthResponse, HealthStatus } from '@inventory/shared';
