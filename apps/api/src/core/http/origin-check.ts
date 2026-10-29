import { ERROR_CODES } from '@ruet-chottor/shared';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence on top of sameSite=lax cookies: a browser always sends `Origin` on cross-origin
 * POST/PATCH/DELETE, so a state-changing request from any other site is refused.
 * Requests without `Origin` (curl, server-to-server) carry no browser cookies by accident.
 */
export function originCheck(allowedOrigin: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    if (SAFE_METHODS.has(req.method) || !origin || origin === allowedOrigin) return next();
    res.status(403).json({
      error: { code: ERROR_CODES.FORBIDDEN, message: 'Request blocked: unexpected origin.' },
    });
  };
}
