import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/lib/tokens.js';

describe('password hashing', () => {
  it('verifies the right password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword('correct-horse-battery-staple', hash)).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword('wrong-horse-battery-staple', hash)).resolves.toBe(false);
  });

  it('produces argon2id hashes that do not contain the password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct-horse');
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password-here'),
      hashPassword('same-password-here'),
    ]);

    expect(a).not.toBe(b);
  });

  it('returns false rather than throwing on a corrupt stored hash', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });
});

describe('access tokens', () => {
  it('round-trips the user id and role', async () => {
    const token = await signAccessToken({ userId: 'user-1', role: 'admin' });

    await expect(verifyAccessToken(token)).resolves.toEqual({ userId: 'user-1', role: 'admin' });
  });

  it('rejects a tampered signature', async () => {
    const token = await signAccessToken({ userId: 'user-1', role: 'viewer' });
    const tampered = `${token.slice(0, -4)}aaaa`;

    await expect(verifyAccessToken(tampered)).resolves.toBeNull();
  });

  it.each([['not-a-jwt'], [''], ['a.b.c']])('rejects %s', async (value) => {
    await expect(verifyAccessToken(value)).resolves.toBeNull();
  });
});

describe('refresh tokens', () => {
  it('stores only a hash, never the token', () => {
    const { token, hash } = createRefreshToken();

    expect(hash).not.toBe(token);
    expect(hash).toBe(hashRefreshToken(token));
    expect(hash).toHaveLength(64);
  });

  it('is unguessable and unique per call', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createRefreshToken().token));

    expect(tokens.size).toBe(50);
    expect([...tokens][0]?.length).toBeGreaterThanOrEqual(43);
  });

  it('expires in the future', () => {
    const { expiresAt } = createRefreshToken();

    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
