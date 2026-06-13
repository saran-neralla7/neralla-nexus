import { pbkdf2Sync, randomBytes } from 'crypto';

/**
 * Hash a PIN string using PBKDF2 with a random salt.
 * Returns salt and hash joined by a colon.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(pin, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a PIN string against a stored hash.
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const checkHash = pbkdf2Sync(pin, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}
