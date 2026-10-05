import { describe, expect, it } from 'vitest';
import { parseClientEnv, parseServerEnv } from '@/lib/env';

describe('parseServerEnv', () => {
  it('applies defaults when nothing is set', () => {
    const env = parseServerEnv({});

    expect(env.API_BASE_URL).toBe('http://localhost:4000/api/v1');
    expect(env.API_REQUEST_TIMEOUT_MS).toBe(8_000);
  });

  it('coerces the timeout to a number', () => {
    expect(parseServerEnv({ API_REQUEST_TIMEOUT_MS: '250' }).API_REQUEST_TIMEOUT_MS).toBe(250);
  });

  it.each([
    ['a non URL base', { API_BASE_URL: 'not-a-url' }],
    ['a zero timeout', { API_REQUEST_TIMEOUT_MS: '0' }],
    ['a non numeric timeout', { API_REQUEST_TIMEOUT_MS: 'soon' }],
  ])('rejects %s', (_label, source) => {
    expect(() => parseServerEnv(source)).toThrow(/Invalid server configuration/);
  });

  it('names the offending variable', () => {
    expect(() => parseServerEnv({ API_BASE_URL: 'nope' })).toThrow(/API_BASE_URL/);
  });
});

describe('parseClientEnv', () => {
  it('defaults the public base URL', () => {
    expect(parseClientEnv({}).NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:4000/api/v1');
  });

  it('rejects an invalid public base URL', () => {
    expect(() => parseClientEnv({ NEXT_PUBLIC_API_BASE_URL: 'nope' })).toThrow(
      /Invalid client configuration/,
    );
  });
});
