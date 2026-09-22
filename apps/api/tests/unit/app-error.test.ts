import { ERROR_CODES } from '@inventory/shared';
import { describe, expect, it } from 'vitest';
import { AppError, isAppError, statusForCode } from '../../src/lib/app-error.js';

describe('AppError', () => {
  it('is a real Error subclass', () => {
    const error = AppError.notFound();

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.stack).toBeDefined();
  });

  it.each([
    ['VALIDATION_ERROR', 400],
    ['UNAUTHORIZED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['PAYLOAD_TOO_LARGE', 413],
    ['RATE_LIMITED', 429],
    ['INTERNAL_ERROR', 500],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    expect(new AppError(code, 'boom').status).toBe(status);
    expect(statusForCode(code)).toBe(status);
  });

  it('gives every shared error code a status', () => {
    for (const code of ERROR_CODES) {
      expect(Number.isInteger(statusForCode(code))).toBe(true);
    }
  });

  it('carries optional details', () => {
    const error = AppError.conflict('Asset already assigned', { assetId: 'BI-LAP-0042' });

    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual({ assetId: 'BI-LAP-0042' });
  });

  it('leaves details undefined when none are given', () => {
    expect(AppError.forbidden().details).toBeUndefined();
  });

  it.each([
    [AppError.validation(), 'VALIDATION_ERROR'],
    [AppError.unauthorized(), 'UNAUTHORIZED'],
    [AppError.forbidden(), 'FORBIDDEN'],
    [AppError.notFound(), 'NOT_FOUND'],
    [AppError.internal(), 'INTERNAL_ERROR'],
  ])('factory produces %s', (error, expected) => {
    expect(error.code).toBe(expected);
    expect(error.message.length).toBeGreaterThan(0);
  });
});

describe('isAppError', () => {
  it('recognises an AppError', () => {
    expect(isAppError(AppError.notFound())).toBe(true);
  });

  it.each([[new Error('plain')], [null], [undefined], ['NOT_FOUND'], [{ code: 'NOT_FOUND' }]])(
    'rejects %s',
    (value) => {
      expect(isAppError(value)).toBe(false);
    },
  );
});
