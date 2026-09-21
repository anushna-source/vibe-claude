import { healthResponseSchema } from '@inventory/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns 200 with the shared health envelope', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.environment).toBe('test');
  });

  it('is not versionless: /health alone is a 404', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(404);
  });

  it('rejects a method the route does not define', async () => {
    const res = await request(app).delete('/api/v1/health');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('request ids', () => {
  it('generates one when the client sends none', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('echoes a safe client supplied id', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'trace-abc_123.4');

    expect(res.headers['x-request-id']).toBe('trace-abc_123.4');
  });

  it.each([
    ['an over long id', 'x'.repeat(200)],
    ['an id with unsafe characters', 'abc<script>'],
    ['an empty id', ''],
  ])('replaces %s', async (_label, value) => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', value);

    expect(res.headers['x-request-id']).not.toBe(value);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('includes the id in error responses', async () => {
    const res = await request(app).get('/api/v1/nope').set('X-Request-Id', 'trace-1');

    expect(res.body.error.requestId).toBe('trace-1');
  });
});
