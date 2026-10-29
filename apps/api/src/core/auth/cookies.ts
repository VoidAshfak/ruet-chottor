import { AUTH_LIMITS } from '@ruet-chottor/shared';
import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'rc_access';
export const REFRESH_COOKIE = 'rc_refresh';

// The refresh token is only ever sent to the auth endpoints that need it.
const REFRESH_PATH = '/api/v1/auth';

// Browsers treat http://localhost as secure, so `secure` works in development too.
const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' };

export function setSessionCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    path: '/',
    maxAge: AUTH_LIMITS.accessTokenSeconds * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: AUTH_LIMITS.refreshTokenDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
}
