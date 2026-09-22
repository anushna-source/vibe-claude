import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { validate, validated } from '../../src/middleware/validate.js';

const bodySchema = z.object({ name: z.string().min(1), count: z.coerce.number().int() });
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

type Body = z.infer<typeof bodySchema>;
type Query = z.infer<typeof querySchema>;

function buildApp(): Express {
  const app = express();
  app.use(express.json());

  app.post('/things', validate({ body: bodySchema, query: querySchema }), (_req, res) => {
    const { body, query } = validated<Body, Query>(res);
    res.status(200).json({ data: { body, query } });
  });

  app.get('/unvalidated', (_req, res, next) => {
    try {
      validated(res);
      res.status(200).json({ data: null });
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('validate', () => {
  it('passes parsed and coerced values through', async () => {
    const res = await request(app).post('/things?page=3').send({ name: 'Laptop', count: '7' });

    expect(res.status).toBe(200);
    expect(res.body.data.body).toEqual({ name: 'Laptop', count: 7 });
    expect(res.body.data.query).toEqual({ page: 3 });
  });

  it('applies schema defaults for absent query params', async () => {
    const res = await request(app).post('/things').send({ name: 'Laptop', count: 1 });

    expect(res.body.data.query).toEqual({ page: 1 });
  });

  it('rejects an invalid body with the standard envelope', async () => {
    const res = await request(app).post('/things').send({ name: '', count: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('labels which part of the request failed', async () => {
    const res = await request(app).post('/things?page=0').send({ name: 'Laptop', count: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.details.issues[0].target).toBe('query');
    expect(res.body.error.details.issues[0].path).toBe('page');
  });

  it('collects issues from every target before failing', async () => {
    const res = await request(app).post('/things?page=0').send({ name: '', count: 'abc' });

    const targets: string[] = res.body.error.details.issues.map(
      (issue: { target: string }) => issue.target,
    );

    expect(new Set(targets)).toEqual(new Set(['body', 'query']));
  });
});

describe('validated', () => {
  it('fails loudly when the middleware was not wired up', async () => {
    const res = await request(app).get('/unvalidated');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
