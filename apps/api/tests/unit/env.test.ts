import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

describe('parseEnv', () => {
  it('applies defaults when nothing is set', () => {
    const parsed = parseEnv({});

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(4000);
    expect(parsed.LOG_LEVEL).toBe('info');
    expect(parsed.JSON_BODY_LIMIT).toBe('100kb');
    expect(parsed.SHUTDOWN_TIMEOUT_MS).toBe(10_000);
    expect(parsed.corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('coerces numeric settings', () => {
    const parsed = parseEnv({ PORT: '8080', SHUTDOWN_TIMEOUT_MS: '250' });

    expect(parsed.PORT).toBe(8080);
    expect(parsed.SHUTDOWN_TIMEOUT_MS).toBe(250);
  });

  it('splits and trims the CORS allow list', () => {
    const parsed = parseEnv({ CORS_ORIGINS: 'http://a.test ,  http://b.test , ' });

    expect(parsed.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
  });

  it('ignores unrelated environment variables', () => {
    const parsed = parseEnv({ SOME_OTHER_TOOL: 'x', PORT: '5000' });

    expect(parsed.PORT).toBe(5000);
    expect(parsed).not.toHaveProperty('SOME_OTHER_TOOL');
  });

  it.each([
    ['a non numeric PORT', { PORT: 'not-a-number' }],
    ['a PORT below range', { PORT: '0' }],
    ['a PORT above range', { PORT: '70000' }],
    ['an unknown NODE_ENV', { NODE_ENV: 'staging' }],
    ['an unknown LOG_LEVEL', { LOG_LEVEL: 'chatty' }],
    ['a negative shutdown timeout', { SHUTDOWN_TIMEOUT_MS: '-1' }],
  ])('rejects %s', (_label, source) => {
    expect(() => parseEnv(source)).toThrow(/Invalid environment configuration/);
  });

  it('names the offending variable in the error', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
