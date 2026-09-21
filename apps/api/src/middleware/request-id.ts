import { randomUUID } from 'node:crypto';
import { type RequestHandler, type Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Only accept an inbound id that cannot forge a log line or inject a header.
 * Anything else is replaced with a fresh UUID.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  // Put it back on the request so the HTTP logger picks up the same id.
  req.headers[REQUEST_ID_HEADER] = id;
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);

  next();
};

/** Reads the id set by `requestId`, without assuming the middleware ran. */
export function getRequestId(res: Response): string | undefined {
  const value: unknown = res.locals.requestId;
  return typeof value === 'string' ? value : undefined;
}
