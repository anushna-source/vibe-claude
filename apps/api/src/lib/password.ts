import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id with OWASP's recommended second option (19 MiB, 2 iterations).
 * Hashes are self-describing, so the parameters can be raised later and old
 * hashes still verify.
 */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/**
 * Never throws on a malformed stored hash: that would turn a data problem into
 * a 500 on the login path and leak which accounts are broken.
 */
export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}
