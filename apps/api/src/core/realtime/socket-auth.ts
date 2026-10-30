import { HttpException } from '@nestjs/common';
import { ERROR_CODES } from '@ruet-chottor/shared';
import type { Socket } from 'socket.io';
import type { AccessTokenStore, Principal } from '../auth/access-token.store.js';
import { ACCESS_COOKIE } from '../auth/cookies.js';

/** What a gateway's connection middleware stores on `socket.data`. */
export interface SocketSession {
  principal: Principal;
  token: string;
}

export type SocketAckError = { ok: false; error: { code: string; message: string } };

/** Reads one cookie from a raw `Cookie` header (the handshake has no cookie-parser). */
export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of header?.split(';') ?? []) {
    const index = part.indexOf('=');
    if (index === -1 || part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Authenticates a socket handshake with the same access cookie as HTTP requests.
 * Returns null when the cookie is missing or expired; the browser then refreshes and reconnects.
 */
export async function authenticateSocket(
  socket: Socket,
  tokens: AccessTokenStore,
): Promise<SocketSession | null> {
  const token = readCookie(socket.handshake.headers.cookie, ACCESS_COOKIE);
  if (!token) return null;
  const principal = await tokens.resolve(token);
  return principal ? { principal, token } : null;
}

/** The `{ code, message }` shape the HTTP error filter uses, for socket acknowledgements. */
export function toAckError(error: unknown): SocketAckError {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === 'object' && body !== null && 'code' in body && 'message' in body) {
      return { ok: false, error: { code: String(body.code), message: String(body.message) } };
    }
    return { ok: false, error: { code: ERROR_CODES.BAD_REQUEST, message: error.message } };
  }
  return {
    ok: false,
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Something went wrong. Please try again.' },
  };
}

export const sessionExpiredAck: SocketAckError = {
  ok: false,
  error: {
    code: ERROR_CODES.SESSION_EXPIRED,
    message: 'Your session has expired. Please log in again.',
  },
};
