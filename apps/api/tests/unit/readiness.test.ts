import { readinessSchema } from '@inventory/shared';
import { describe, expect, it } from 'vitest';
import { getReadiness } from '../../src/modules/health/health.service.js';

const now = (): Date => new Date('2026-09-29T04:00:00.000Z');

describe('getReadiness', () => {
  it('reports ready when the database answers', async () => {
    const readiness = await getReadiness({ databaseReachable: () => Promise.resolve(true), now });

    expect(readiness).toEqual({
      status: 'ready',
      checks: { database: 'up' },
      timestamp: '2026-09-29T04:00:00.000Z',
    });
  });

  it('reports not ready when the database is unreachable', async () => {
    const readiness = await getReadiness({ databaseReachable: () => Promise.resolve(false), now });

    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.database).toBe('down');
  });

  it('matches the shared readiness schema either way', async () => {
    for (const reachable of [true, false]) {
      const readiness = await getReadiness({
        databaseReachable: () => Promise.resolve(reachable),
        now,
      });

      expect(readinessSchema.safeParse(readiness).success).toBe(true);
    }
  });
});
