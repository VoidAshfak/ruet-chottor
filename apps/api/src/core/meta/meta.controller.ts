import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FeaturesResponse, HealthResponse } from '@ruet-chottor/shared';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller()
export class MetaController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness + dependency status. "degraded" means a configured service is unreachable. */
  @Get('health')
  async health(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.prisma.health(), this.redis.health()]);
    const status = database === 'down' || redis === 'down' ? 'degraded' : 'ok';
    return { status, checks: { database, redis } };
  }

  /** Which modules are switched on; the web app builds its navigation from this. */
  @Get('features')
  features(): FeaturesResponse {
    return { modules: this.config.get('ENABLED_MODULES', { infer: true }) };
  }
}
