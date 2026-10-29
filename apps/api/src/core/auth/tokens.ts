import { createHash, randomBytes } from 'node:crypto';

/** 256-bit random token, URL safe. Used for access tokens, refresh tokens and OTP challenge ids. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are high-entropy, so a plain SHA-256 is enough to store them safely. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
