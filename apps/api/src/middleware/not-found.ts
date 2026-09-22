import { type RequestHandler } from 'express';
import { AppError } from '../lib/app-error.js';

/** Runs after every route, so an unmatched path returns the standard envelope. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
};
