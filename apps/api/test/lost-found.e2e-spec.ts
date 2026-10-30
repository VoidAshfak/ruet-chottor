import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  lostFoundItemSchema,
  lostFoundPageSchema,
  mediaAssetSchema,
  type Role,
  uploadTicketSchema,
} from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { MailService } from '../src/core/mail/mail.service.js';
import { CloudinaryClient } from '../src/core/media/cloudinary.client.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import type { User } from '../src/generated/prisma/client.js';
import { FakeCloudinary } from './fakes/fake-cloudinary.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const FLAGS = ['FEATURE_AUTH', 'FEATURE_ADMIN', 'FEATURE_LOST_FOUND', 'FEATURE_MODERATION'];
type Person = 'finder' | 'owner' | 'admin';
const FOUND = {
  kind: 'found',
  category: 'phone',
  title: 'Black phone in a blue case',
  description: 'Found on a bench, switched off.',
  place: 'central_library',
  placeDetail: 'Second floor reading room',
  happenedOn: '2026-10-28',
  verifyQuestion: 'What is the lock-screen photo?',
};

describe('Lost & found (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new FakePrisma();
  const redis = new FakeRedis();
  const cloudinary = new FakeCloudinary();
  const people = {} as Record<Person, User>;
  const cookies = {} as Record<Person, string>;

  const http = () => request(app.getHttpServer());
  const as = (who: Person) => ({
    get: (path: string) => http().get(`/api/v1${path}`).set('Cookie', cookies[who]),
    post: (path: string, body: object = {}) =>
      http().post(`/api/v1${path}`).set('Cookie', cookies[who]).send(body),
    patch: (path: string, body: object) =>
      http().patch(`/api/v1${path}`).set('Cookie', cookies[who]).send(body),
    delete: (path: string) => http().delete(`/api/v1${path}`).set('Cookie', cookies[who]),
  });
  const post = async (who: Person = 'finder', body: object = FOUND) =>
    lostFoundItemSchema.parse((await as(who).post('/lost-found/items', body).expect(201)).body);
  const board = async (query = '') =>
    lostFoundPageSchema.parse((await as('owner').get(`/lost-found/items${query}`).expect(200)).body)
      .items;

  beforeAll(async () => {
    for (const flag of FLAGS) process.env[flag] = 'true';
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ client: redis, health: async () => 'up' })
      .overrideProvider(CloudinaryClient)
      .useValue(cloudinary)
      .overrideProvider(MailService)
      .useValue({ send: async () => {} })
      .compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const flag of FLAGS) delete process.env[flag];
  });

  beforeEach(async () => {
    prisma.users = [];
    prisma.lostFoundItems = [];
    prisma.mediaAssets = [];
    prisma.reports = [];
    prisma.moderationLogs = [];
    cloudinary.uploaded.clear();
    cloudinary.destroyed = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['finder', 'Rafiq Sample', '2103901', 'student'],
      ['owner', 'Nusrat Example', '2101902', 'student'],
      ['admin', 'Demo Admin', '0000001', 'admin'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: { name, roll, role, email: `lf${index}@example.com`, phone: `+8801766666${index}66` },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
  });

  describe('posting', () => {
    it('needs a login', async () => {
      await http().get('/api/v1/lost-found/items').expect(401);
    });

    it('puts a post on the board with its check question, without contact details', async () => {
      const item = await post();
      expect(item).toMatchObject({
        isMine: true,
        state: 'open',
        expired: false,
        happenedOn: '2026-10-28',
      });
      const items = await board();
      expect(items.map((i) => i.id)).toEqual([item.id]);
      expect(items[0]).toMatchObject({
        isMine: false,
        verifyQuestion: 'What is the lock-screen photo?',
      });
      expect(JSON.stringify(items)).not.toMatch(/@example\.com|\+880/);
    });

    it('validates posts; lost items have no check question', async () => {
      await as('finder')
        .post('/lost-found/items', { ...FOUND, kind: 'lost' })
        .expect(400);
      await as('finder')
        .post('/lost-found/items', { ...FOUND, category: 'pet' })
        .expect(400);
      await as('finder')
        .post('/lost-found/items', { ...FOUND, happenedOn: 'yesterday' })
        .expect(400);
      await as('finder')
        .post('/lost-found/items', { ...FOUND, title: 'x' })
        .expect(400);
    });

    it('filters and searches the board', async () => {
      await post();
      await post('owner', {
        ...FOUND,
        kind: 'lost',
        verifyQuestion: null,
        category: 'id_card',
        title: 'Student ID card',
        place: 'cafeteria',
      });
      expect((await board('?kind=lost')).map((i) => i.title)).toEqual(['Student ID card']);
      expect((await board('?category=phone')).map((i) => i.title)).toEqual([
        'Black phone in a blue case',
      ]);
      expect((await board('?q=blue%20case')).map((i) => i.title)).toEqual([
        'Black phone in a blue case',
      ]);
      expect((await board('?place=cafeteria')).map((i) => i.title)).toEqual(['Student ID card']);
    });

    it('blocks suspended members', async () => {
      people.finder.status = 'suspended';
      await as('finder').post('/lost-found/items', FOUND).expect(403);
    });
  });

  describe('state and expiry', () => {
    it('leaves the board when returned, and comes back when reopened', async () => {
      const item = await post();
      await as('owner')
        .post(`/lost-found/items/${item.id}/state`, { state: 'returned' })
        .expect(403);
      await as('finder')
        .post(`/lost-found/items/${item.id}/state`, { state: 'returned' })
        .expect(200);
      expect(await board()).toEqual([]);
      const mine = lostFoundPageSchema.parse(
        (await as('finder').get('/lost-found/items/mine')).body,
      );
      expect(mine.items[0]?.state).toBe('returned');
      await as('finder').post(`/lost-found/items/${item.id}/state`, { state: 'open' }).expect(200);
      expect((await board()).map((i) => i.id)).toEqual([item.id]);
    });

    it('drops posts after 30 days until reopened for another 30', async () => {
      const item = await post();
      prisma.lostFoundItems[0]!.expiresAt = new Date(Date.now() - 1000);
      expect(await board()).toEqual([]);
      const own = await as('finder').get(`/lost-found/items/${item.id}`).expect(200);
      expect(own.body).toMatchObject({ state: 'open', expired: true });
      const reopened = await as('finder')
        .post(`/lost-found/items/${item.id}/state`, { state: 'open' })
        .expect(200);
      expect(Date.parse(reopened.body.expiresAt)).toBeGreaterThan(Date.now() + 29 * 24 * 3600e3);
      expect(await board()).toHaveLength(1);
    });

    it('only the poster edits or deletes', async () => {
      const item = await post();
      await as('owner').patch(`/lost-found/items/${item.id}`, FOUND).expect(403);
      await as('owner').delete(`/lost-found/items/${item.id}`).expect(403);
      const edited = await as('finder')
        .patch(`/lost-found/items/${item.id}`, { ...FOUND, placeDetail: 'Ground floor' })
        .expect(200);
      expect(edited.body.placeDetail).toBe('Ground floor');
      await as('finder').delete(`/lost-found/items/${item.id}`).expect(204);
      await as('owner').get(`/lost-found/items/${item.id}`).expect(404);
    });
  });

  describe('photos and moderation', () => {
    it('attaches the poster’s photos and deletes them with the post', async () => {
      const ticket = uploadTicketSchema.parse(
        (
          await as('finder')
            .post('/media/uploads', {
              purpose: 'lost-found.item',
              kind: 'image',
              fileName: 'phone.jpg',
              bytes: 4000,
            })
            .expect(201)
        ).body,
      );
      cloudinary.uploaded.set(ticket.fields.public_id!, {
        format: 'jpg',
        bytes: 4000,
        width: 600,
        height: 800,
      });
      const photo = mediaAssetSchema.parse(
        (await as('finder').post(`/media/uploads/${ticket.assetId}/complete`).expect(200)).body,
      );
      const item = await post('finder', { ...FOUND, mediaIds: [photo.id] });
      expect(item.photos.map((p) => p.id)).toEqual([photo.id]);
      await as('finder').delete(`/lost-found/items/${item.id}`).expect(204);
      expect(cloudinary.destroyed).toHaveLength(1);
    });

    it('reported posts can be hidden from the board', async () => {
      const item = await post();
      await as('owner')
        .post('/moderation/reports', {
          contentType: 'lost-found.item',
          contentId: item.id,
          reason: 'scam',
        })
        .expect(204);
      await as('admin')
        .post(`/moderation/items/lost-found.item/${item.id}/hide`, {
          reason: 'Fake post asking for money',
        })
        .expect(200);
      expect(await board()).toEqual([]);
      await as('owner').get(`/lost-found/items/${item.id}`).expect(404);
      const own = await as('finder').get(`/lost-found/items/${item.id}`).expect(200);
      expect(own.body.moderated).toBe(true);
    });
  });
});
