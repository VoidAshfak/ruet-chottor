import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { MetaController } from './meta/meta.controller.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

/** Infrastructure every module can inject: config, database, Redis. */
@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv })],
  controllers: [MetaController],
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class CoreModule {}
