import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AccessTokenStore } from './auth/access-token.store.js';
import { AuthGuard } from './auth/auth.guard.js';
import { validateEnv } from './config/env.js';
import { MailService } from './mail/mail.service.js';
import { MetaController } from './meta/meta.controller.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RateLimitService } from './rate-limit/rate-limit.service.js';
import { RedisService } from './redis/redis.service.js';

/**
 * Infrastructure every module can inject: config, database, Redis, mail, rate limits, and the
 * access-token check. The AuthGuard is global, so every route is private unless @Public().
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Tests must not pick up a developer's real .env (hosted DB, feature flags).
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
  ],
  controllers: [MetaController],
  providers: [
    PrismaService,
    RedisService,
    MailService,
    RateLimitService,
    AccessTokenStore,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PrismaService, RedisService, MailService, RateLimitService, AccessTokenStore],
})
export class CoreModule {}
