import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mediaAssetSchema, uploadTicketSchema } from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { CloudinaryClient } from '../src/core/media/cloudinary.client.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import { FakeCloudinary } from './fakes/fake-cloudinary.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const IMAGE = { purpose: 'news.post', kind: 'image', fileName: 'notice.jpg', bytes: 200_000 };

describe('Media uploads (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new FakePrisma();
  const redis = new FakeRedis();
  const cloudinary = new FakeCloudinary();
  const cookies: Record<'owner' | 'other', string> = { owner: '', other: '' };

  const as = (who: keyof typeof cookies) => ({
    post: (path: string, body: object = {}) =>
      request(app.getHttpServer())
        .post(`/api/v1/media${path}`)
        .set('Cookie', cookies[who])
        .send(body),
    delete: (path: string) =>
      request(app.getHttpServer()).delete(`/api/v1/media${path}`).set('Cookie', cookies[who]),
  });
  const ticket = async (body: object = IMAGE) =>
    uploadTicketSchema.parse((await as('owner').post('/uploads', body).expect(201)).body);

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ client: redis, health: async () => 'up' })
      .overrideProvider(CloudinaryClient)
      .useValue(cloudinary)
      .compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    prisma.mediaAssets = [];
    cloudinary.configured = true;
    cloudinary.uploaded.clear();
    cloudinary.destroyed = [];
    for (const key of redis.keys()) void redis.del(key);
    const tokens = app.get(AccessTokenStore);
    cookies.owner = `rc_access=${await tokens.issue({ userId: '0190f0e0-0000-7000-8000-000000000001', sessionId: 's1', role: 'student' })}`;
    cookies.other = `rc_access=${await tokens.issue({ userId: '0190f0e0-0000-7000-8000-000000000002', sessionId: 's2', role: 'student' })}`;
  });

  it('needs a login', async () => {
    await request(app.getHttpServer()).post('/api/v1/media/uploads').send(IMAGE).expect(401);
  });

  it('answers 503 when Cloudinary is not configured', async () => {
    cloudinary.configured = false;
    const res = await as('owner').post('/uploads', IMAGE).expect(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('validates kind, extension, size and purpose before signing', async () => {
    await as('owner')
      .post('/uploads', { ...IMAGE, fileName: 'notice.exe' })
      .expect(400);
    await as('owner')
      .post('/uploads', { ...IMAGE, bytes: 11 * 1024 * 1024 })
      .expect(400);
    await as('owner')
      .post('/uploads', { ...IMAGE, kind: 'document', fileName: 'notes.pdf' })
      .expect(400); // news posts take images and videos only
    await as('owner')
      .post('/uploads', { ...IMAGE, purpose: 'chat.message' })
      .expect(400);
  });

  it('signs an upload straight to Cloudinary, then checks the stored file', async () => {
    const t = await ticket();
    expect(t.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(t.fields).toMatchObject({
      api_key: 'key',
      public_id: expect.stringContaining(t.assetId),
    });
    expect(JSON.stringify(t)).not.toContain('secret');

    // Not uploaded yet.
    await as('owner').post(`/uploads/${t.assetId}/complete`).expect(400);

    cloudinary.uploaded.set(t.fields.public_id!, {
      format: 'jpg',
      bytes: 200_000,
      width: 1200,
      height: 800,
    });
    const asset = mediaAssetSchema.parse(
      (await as('owner').post(`/uploads/${t.assetId}/complete`).expect(200)).body,
    );
    expect(asset).toMatchObject({ kind: 'image', width: 1200, format: 'jpg' });
    expect(asset.url).toContain('f_auto,q_auto');
  });

  it('deletes a file that is not what was promised', async () => {
    const t = await ticket();
    cloudinary.uploaded.set(t.fields.public_id!, {
      format: 'svg',
      bytes: 1000,
      width: 10,
      height: 10,
    });
    await as('owner').post(`/uploads/${t.assetId}/complete`).expect(400);
    expect(cloudinary.destroyed).toEqual([t.fields.public_id]);
    expect(prisma.mediaAssets).toHaveLength(0);
  });

  it('keeps uploads private to their owner', async () => {
    const t = await ticket();
    await as('other').post(`/uploads/${t.assetId}/complete`).expect(404);
    await as('other').delete(`/uploads/${t.assetId}`).expect(404);
    await as('owner').delete(`/uploads/${t.assetId}`).expect(204);
    expect(prisma.mediaAssets).toHaveLength(0);
  });
});
