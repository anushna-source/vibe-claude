import { env } from '../../config/env.js';
import { isDatabaseReachable } from '../../db/client.js';
import type { Health, Readiness } from './health.schema.js';

/** Injected so tests get a deterministic reading. */
export interface HealthClock {
  uptimeSeconds: () => number;
  now: () => Date;
}

const systemClock: HealthClock = {
  uptimeSeconds: () => process.uptime(),
  now: () => new Date(),
};

export function getHealth(clock: HealthClock = systemClock): Health {
  return {
    status: 'ok',
    uptimeSeconds: Math.round(clock.uptimeSeconds() * 1000) / 1000,
    timestamp: clock.now().toISOString(),
    version: env.APP_VERSION,
    environment: env.NODE_ENV,
  };
}

export interface ReadinessDeps {
  databaseReachable: () => Promise<boolean>;
  now: () => Date;
}

const defaultReadinessDeps: ReadinessDeps = {
  databaseReachable: () => isDatabaseReachable(),
  now: () => new Date(),
};

/**
 * Liveness says the process is up; readiness says it can actually serve.
 * A load balancer should drain this instance when the database is unreachable.
 */
export async function getReadiness(deps: ReadinessDeps = defaultReadinessDeps): Promise<Readiness> {
  const databaseUp = await deps.databaseReachable();

  return {
    status: databaseUp ? 'ready' : 'not_ready',
    checks: { database: databaseUp ? 'up' : 'down' },
    timestamp: deps.now().toISOString(),
  };
}
