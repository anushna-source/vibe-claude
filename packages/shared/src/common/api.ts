import { z } from 'zod';

/**
 * The response envelopes every endpoint uses (see AGENTS.md, "API conventions").
 * Single resources return `{ data }`, lists return `{ data, meta }`, failures
 * return `{ error: { code, message, details? } }`.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
    requestId: z.string().min(1).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Query parameters accepted by every list endpoint. */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export type ApiResponse<T> = { data: T };
export type ApiListResponse<T> = { data: T[]; meta: PaginationMeta };

/** Builds the `{ data }` envelope so call sites cannot forget it. */
export function toApiResponse<T>(data: T): ApiResponse<T> {
  return { data };
}

export function toApiListResponse<T>(data: T[], meta: PaginationMeta): ApiListResponse<T> {
  return { data, meta };
}
