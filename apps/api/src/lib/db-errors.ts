/**
 * Turning Postgres failures into something a caller can act on.
 * A raw "duplicate key value violates unique constraint" is not an error
 * message a person should ever see.
 */

/** Unique violation. */
const UNIQUE_VIOLATION = '23505';

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function errorConstraint(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === 'string' ? constraint : undefined;
}

/** True when the write collided with a unique index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (errorCode(error) !== UNIQUE_VIOLATION) return false;
  return constraint === undefined || errorConstraint(error) === constraint;
}
