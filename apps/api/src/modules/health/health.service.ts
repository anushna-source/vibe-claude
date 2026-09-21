import { env } from '../../config/env.js';
import { type Health } from './health.schema.js';

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
