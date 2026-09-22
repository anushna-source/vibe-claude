import { type RequestHandler, type Response } from 'express';
import { type ZodType } from 'zod';
import { AppError } from '../lib/app-error.js';

/**
 * Request validation at the route boundary: no unvalidated input reaches a
 * service (AGENTS.md, "API conventions").
 *
 * Express 5 makes `req.query` read only, so parsed values are stored on
 * `res.locals` and read back with `validated()`.
 */

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export interface ValidatedRequest<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body: TBody;
  query: TQuery;
  params: TParams;
}

const VALIDATED_KEY = 'validated';
const TARGETS = ['body', 'query', 'params'] as const;

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    const issues: { target: string; path: string; message: string }[] = [];
    const parsedValues: ValidatedRequest = { body: undefined, query: undefined, params: undefined };

    for (const target of TARGETS) {
      const schema = schemas[target];
      if (schema === undefined) continue;

      const result = schema.safeParse(req[target]);
      if (result.success) {
        parsedValues[target] = result.data;
        continue;
      }

      for (const issue of result.error.issues) {
        issues.push({ target, path: issue.path.join('.'), message: issue.message });
      }
    }

    if (issues.length > 0) {
      next(AppError.validation('Request validation failed', { issues }));
      return;
    }

    res.locals[VALIDATED_KEY] = parsedValues;
    next();
  };
}

/**
 * Reads what `validate()` parsed for this request. The assertion is safe because
 * the caller names the same schema types it registered on the route, and zod has
 * already guaranteed the runtime shape.
 */
export function validated<TBody = unknown, TQuery = unknown, TParams = unknown>(
  res: Response,
): ValidatedRequest<TBody, TQuery, TParams> {
  const value: unknown = res.locals[VALIDATED_KEY];

  if (value === undefined) {
    throw new Error('validate() middleware did not run for this route');
  }

  return value as ValidatedRequest<TBody, TQuery, TParams>;
}
