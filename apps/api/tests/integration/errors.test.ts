import { errorResponseSchema } from '@inventory/shared';
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../../src/app.js';
import { AppError } from '../../src/lib/app-error.js';
import { errorHandler } from '../../src/middleware/error-handler.js';

const app = createApp();

describe('error envelope', () => {
  it('returns the standard shape for an unknown route', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not reflect the query string back to the client', async () => {
    const res = await request(app).get('/api/v1/nope?evil=<script>alert(1)</script>');

    expect(res.body.error.message).not.toContain('<script>');
  });

  it('rejects malformed JSON with a validation error', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a body over the configured limit', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .send({ blob: 'x'.repeat(5000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('unexpected failures', () => {
  function buildFailingApp(): Express {
    const failing = express();

    failing.get('/sync', () => {
      throw new Error('database password is hunter2');
    });

    failing.get('/async', (_req, _res, next) => {
      next(new Error('database password is hunter2'));
    });

    failing.get('/known', (_req, _res, next) => {
      next(AppError.conflict('Asset already has a live assignment', { assetId: 'BI-LAP-0042' }));
    });

    // A service that parses with zod and lets the ZodError escape.
    failing.get('/zod', () => {
      z.object({ assetTag: z.string() }).parse({ assetTag: 42 });
    });

    failing.use(errorHandler);
    return failing;
  }

  const failing = buildFailingApp();

  it.each([['/sync'], ['/async']])('turns %s into a generic 500', async (path) => {
    const res = await request(failing).get(path);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });

  it.each([['/sync'], ['/async']])('never leaks internals from %s', async (path) => {
    const res = await request(failing).get(path);
    const serialized = JSON.stringify(res.body);

    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('at ');
    expect(res.body.error.stack).toBeUndefined();
  });

  it('turns a stray ZodError into a 400 with its issues', async () => {
    const res = await request(failing).get('/zod');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0].path).toBe('assetTag');
  });

  it('passes an AppError through with its code and details', async () => {
    const res = await request(failing).get('/known');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe('Asset already has a live assignment');
    expect(res.body.error.details).toEqual({ assetId: 'BI-LAP-0042' });
  });
});
