import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@ruet-chottor/shared';
import { RedisService } from '../redis/redis.service.js';
import { requireRedis } from '../redis/require-redis.js';

export interface RateLimitRule {
  /** Groups counters, e.g. `auth:login:ip`. */
  name: string;
  limit: number;
  windowSeconds: number;
}

/** Fixed-window counters in Redis, shared by every API instance. */
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /** Counts one hit for `subject` (an IP, a roll, a user id). Throws 429 once over the limit. */
  async consume(rule: RateLimitRule, subject: string): Promise<void> {
    const client = requireRedis(this.redis);
    const key = `ratelimit:${rule.name}:${subject}`;
    const hits = await client.incr(key);
    if (hits === 1) await client.expire(key, rule.windowSeconds);
    if (hits > rule.limit) {
      const ttl = await client.ttl(key);
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: `Too many attempts. Try again in ${formatWait(ttl > 0 ? ttl : rule.windowSeconds)}.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Clears a counter, e.g. the per-roll login counter after a successful login. */
  async reset(rule: RateLimitRule, subject: string): Promise<void> {
    await requireRedis(this.redis).del(`ratelimit:${rule.name}:${subject}`);
  }
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
