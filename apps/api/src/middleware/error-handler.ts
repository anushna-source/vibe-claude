import { type ErrorCode, type ErrorResponse } from '@inventory/shared';
import { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';
import { getRequestId } from './request-id.js';

interface NormalizedError {
  code: ErrorCode;
  status: number;
  message: string;
  details?: unknown;
}

function readStringProp(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const prop = record[key];
  return typeof prop === 'string' ? prop : undefined;
}

function normalize(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    return { code: err.code, status: err.status, message: err.message, details: err.details };
  }

  if (err instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Request validation failed',
      details: {
        issues: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }

  // body-parser tags its failures with a `type`.
  switch (readStringProp(err, 'type')) {
    case 'entity.too.large':
      return { code: 'PAYLOAD_TOO_LARGE', status: 413, message: 'Request body is too large' };
    case 'entity.parse.failed':
    case 'encoding.unsupported':
    case 'charset.unsupported':
      return { code: 'VALIDATION_ERROR', status: 400, message: 'Request body could not be parsed' };
    default:
      break;
  }

  // Anything unrecognised is a bug. Log it in full, tell the client nothing.
  return { code: 'INTERNAL_ERROR', status: 500, message: 'Something went wrong' };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const normalized = normalize(err);
  const requestId = getRequestId(res);
  const context = {
    requestId,
    code: normalized.code,
    method: req.method,
    path: req.path,
  };

  if (normalized.status >= 500) {
    logger.error({ ...context, err }, 'Unhandled request error');
  } else {
    logger.warn(context, normalized.message);
  }

  if (res.headersSent) {
    next(err);
    return;
  }

  const body: ErrorResponse = {
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details === undefined ? {} : { details: normalized.details }),
      ...(requestId === undefined ? {} : { requestId }),
    },
  };

  res.status(normalized.status).json(body);
};
