import { Injectable } from '@nestjs/common';
import { AUTH_LIMITS, ROLES } from '@ruet-chottor/shared';
import { z } from 'zod';
import { RedisService } from '../redis/redis.service.js';
import { requireRedis } from '../redis/require-redis.js';
import { hashToken, newToken } from './tokens.js';

const principalSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  role: z.enum(ROLES),
});

/** Who is making the request. Attached to `req.user` by the AuthGuard. */
export type Principal = z.infer<typeof principalSchema>;

const key = (token: string) => `auth:access:${hashToken(token)}`;
/** Points from a session to its one live access token, so revoking the session ends access at once. */
const sessionKey = (sessionId: string) => `auth:session-access:${sessionId}`;

/**
 * Short-lived opaque access tokens in Redis (ADR 0005). Unlike a JWT, deleting the key
 * ends access immediately: on logout, and when a session is revoked (suspension, ban).
 */
@Injectable()
export class AccessTokenStore {
  constructor(private readonly redis: RedisService) {}

  /** A new access token for the session; the session's previous one stops working. */
  async issue(principal: Principal): Promise<string> {
    const redis = requireRedis(this.redis);
    const token = newToken();
    const previous = await redis.get(sessionKey(principal.sessionId));
    if (previous) await redis.del(previous);
    await redis.set(key(token), JSON.stringify(principal), 'EX', AUTH_LIMITS.accessTokenSeconds);
    await redis.set(
      sessionKey(principal.sessionId),
      key(token),
      'EX',
      AUTH_LIMITS.accessTokenSeconds,
    );
    return token;
  }

  async resolve(token: string): Promise<Principal | null> {
    const raw = await requireRedis(this.redis).get(key(token));
    if (!raw) return null;
    const parsed = principalSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  }

  async revoke(token: string): Promise<void> {
    await requireRedis(this.redis).del(key(token));
  }

  /**
   * Ends the access of these sessions immediately (logout, suspension, ban, a stolen refresh token),
   * instead of waiting up to 15 minutes for their access tokens to expire.
   */
  async revokeSessions(sessionIds: string[]): Promise<void> {
    const redis = requireRedis(this.redis);
    for (const sessionId of sessionIds) {
      const current = await redis.get(sessionKey(sessionId));
      if (current) await redis.del(current, sessionKey(sessionId));
    }
  }
}
