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

/**
 * Short-lived opaque access tokens in Redis (ADR 0005). Unlike a JWT, deleting the key
 * ends access immediately, e.g. on logout.
 */
@Injectable()
export class AccessTokenStore {
  constructor(private readonly redis: RedisService) {}

  async issue(principal: Principal): Promise<string> {
    const token = newToken();
    await requireRedis(this.redis).set(
      key(token),
      JSON.stringify(principal),
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
}
