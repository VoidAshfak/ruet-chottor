import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { featuresResponseSchema, healthResponseSchema } from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';

describe('Meta endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.FEATURE_CHAT = 'true';
    // Imported after setting the flag: ConfigModule reads the environment when the module loads.
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // No real database or Redis in tests.
      .overrideProvider(PrismaService)
      .useValue({ health: async () => 'up', $disconnect: async () => undefined })
      .overrideProvider(RedisService)
      .useValue({ health: async () => 'down' })
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.FEATURE_CHAT;
  });

  it('GET /api/v1/health reports each dependency', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({
      status: 'degraded',
      checks: { database: 'up', redis: 'down' },
    });
  });

  it('GET /api/v1/features lists enabled modules', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/features').expect(200);
    expect(featuresResponseSchema.parse(res.body)).toEqual({ modules: ['chat'] });
  });

  it('unknown routes return the standard error shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('sets security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
