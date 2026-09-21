import { healthSchema } from '@inventory/shared';
import { describe, expect, it } from 'vitest';
import { getHealth, type HealthClock } from '../../src/modules/health/health.service.js';

const fixedClock: HealthClock = {
  uptimeSeconds: () => 12.34567,
  now: () => new Date('2026-09-21T04:12:55.123Z'),
};

describe('getHealth', () => {
  it('reports ok against a fixed clock', () => {
    const health = getHealth(fixedClock);

    expect(health).toEqual({
      status: 'ok',
      uptimeSeconds: 12.346,
      timestamp: '2026-09-21T04:12:55.123Z',
      version: '0.0.0-test',
      environment: 'test',
    });
  });

  it('rounds uptime to milliseconds', () => {
    const health = getHealth({ ...fixedClock, uptimeSeconds: () => 0.00049 });

    expect(health.uptimeSeconds).toBe(0);
  });

  it('satisfies the shared health schema with the real clock', () => {
    const result = healthSchema.safeParse(getHealth());

    expect(result.success).toBe(true);
  });

  it('emits a UTC timestamp', () => {
    expect(getHealth().timestamp).toMatch(/Z$/);
  });
});
