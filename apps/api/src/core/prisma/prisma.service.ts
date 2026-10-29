import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { Env } from '../config/env.js';
import type { ServiceHealth } from '../meta/service-health.js';

/** The only way modules talk to the database (CLAUDE.md §11). Connects lazily on first query. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly configured: boolean;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('DATABASE_URL', { infer: true });
    super({
      adapter: new PrismaPg({ connectionString: url ?? 'postgresql://not-configured/none' }),
    });
    this.configured = url !== undefined;
  }

  async health(): Promise<ServiceHealth> {
    if (!this.configured) return 'not_configured';
    try {
      await this.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
