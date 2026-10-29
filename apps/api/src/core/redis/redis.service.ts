import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';
import type { ServiceHealth } from '../meta/service-health.js';

const PING_TIMEOUT_MS = 2000;

/** Shared Redis connection: cache, rate limits, OTP store, Socket.IO adapter. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis | null;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true });
    this.client = url
      ? new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => Math.min(times * 500, 5000),
        })
      : null;
    // Without a listener ioredis reports every failed reconnect as an unhandled error event.
    this.client?.on('error', (error: Error) => this.logger.warn(`Redis: ${error.message}`));
  }

  async health(): Promise<ServiceHealth> {
    if (!this.client) return 'not_configured';
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), PING_TIMEOUT_MS);
      });
      await Promise.race([this.client.ping(), timeout]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }

  async onModuleDestroy() {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit().catch(() => undefined);
    }
  }
}
