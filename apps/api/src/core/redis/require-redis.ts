import { ServiceUnavailableException } from '@nestjs/common';
import { ERROR_CODES } from '@ruet-chottor/shared';
import type { Redis } from 'ioredis';
import type { RedisService } from './redis.service.js';

/** Login, OTPs and rate limits cannot work without Redis; fail clearly instead of silently. */
export function requireRedis(redis: RedisService): Redis {
  if (!redis.client) {
    throw new ServiceUnavailableException({
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: 'Redis is not configured',
    });
  }
  return redis.client;
}
