import { healthResponseSchema, type Health } from '@inventory/shared';
import { apiRequest } from './api-client';

/** Reads GET /api/v1/health, validated against the schema both apps share. */
export function getHealth(signal?: AbortSignal): Promise<Health> {
  return apiRequest<Health>('/health', {
    schema: healthResponseSchema,
    ...(signal ? { signal } : {}),
  });
}
