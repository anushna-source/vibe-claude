import { type ErrorCode } from '@inventory/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * The only error type services should throw. The error handler turns it into the
 * `{ error: { code, message, details? } }` envelope from AGENTS.md.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
    Error.captureStackTrace(this, AppError);
  }

  static validation(message = 'Request validation failed', details?: unknown): AppError {
    return new AppError('VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource'): AppError {
    return new AppError('FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError('NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError('CONFLICT', message, details);
  }

  static internal(message = 'Something went wrong'): AppError {
    return new AppError('INTERNAL_ERROR', message);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}
