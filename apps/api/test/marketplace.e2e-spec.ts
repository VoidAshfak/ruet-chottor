import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  listingPageSchema,
  listingSchema,
  moderationQueuePageSchema,
  type Role,
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

const FLAGS = ['FEATURE_AUTH', 'FEATURE_ADMIN', 'FEATURE_MARKETPLACE', 'FEATURE_MODERATION'];
type Person = 'seller' | 'buyer' | 'moderator';
const LISTING = {
  title: 'Casio fx-991EX calculator',
  category: 'electronics',
  condition: 'like_new',
  priceTaka: 1200,
  description: 'Used for one term.',
  meetPlace: 'cafeteria',
  meetDetail: 'Near the tea stall',
};

describe('Marketplace (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new FakePrisma();
  const redis = new FakeRedis();
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
  const sell = async (body: object = {}) =>
    listingSchema.parse(
      (
        await as('seller')
          .post('/marketplace/listings', { ...LISTING, ...body })
          .expect(201)
      ).body,
    );
  const browse = async (query = '') =>
    listingPageSchema.parse(
      (await as('buyer').get(`/marketplace/listings${query}`).expect(200)).body,
    ).items;

  beforeAll(async () => {
    for (const flag of FLAGS) process.env[flag] = 'true';
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ client: redis, health: async () => 'up' })
      .overrideProvider(CloudinaryClient)
      .useValue(new FakeCloudinary())
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
    prisma.listings = [];
    prisma.reports = [];
    prisma.moderationLogs = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['seller', 'Rafiq Sample', '2103901', 'student'],
      ['buyer', 'Nusrat Example', '2101902', 'student'],
      ['moderator', 'Demo Moderator', '0000002', 'moderator'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: { name, roll, role, email: `mk${index}@example.com`, phone: `+8801777777${index}77` },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
  });

  describe('selling and browsing', () => {
    it('needs a login', async () => {
      await http().get('/api/v1/marketplace/listings').expect(401);
    });

    it('lists items for others, without contact details', async () => {
      const listing = await sell();
      expect(listing).toMatchObject({ isMine: true, state: 'available', heldFor: null });
      const items = await browse();
      expect(items.map((i) => i.id)).toEqual([listing.id]);
      expect(JSON.stringify(items)).not.toMatch(/@example\.com|\+880/);
    });

    it('filters by price and category, and sorts by price', async () => {
      await sell();
      await sell({ title: 'Engineering drawing set', category: 'lab_equipment', priceTaka: 350 });
      await sell({ title: 'Old physics notes', category: 'books', priceTaka: 0 });
      expect((await browse('?sort=price_asc')).map((i) => i.priceTaka)).toEqual([0, 350, 1200]);
      expect((await browse('?sort=price_desc')).map((i) => i.priceTaka)).toEqual([1200, 350, 0]);
      expect((await browse('?maxPrice=0')).map((i) => i.title)).toEqual(['Old physics notes']);
      expect((await browse('?minPrice=300&maxPrice=1000')).map((i) => i.priceTaka)).toEqual([350]);
      expect((await browse('?category=books')).map((i) => i.title)).toEqual(['Old physics notes']);
      await as('buyer').get('/marketplace/listings?minPrice=500&maxPrice=100').expect(400);
    });

    it('validates listings', async () => {
      await as('seller')
        .post('/marketplace/listings', { ...LISTING, priceTaka: -1 })
        .expect(400);
      await as('seller')
        .post('/marketplace/listings', { ...LISTING, priceTaka: 9.5 })
        .expect(400);
      await as('seller')
        .post('/marketplace/listings', { ...LISTING, condition: 'broken' })
        .expect(400);
      await as('seller')
        .post('/marketplace/listings', { ...LISTING, sellerId: people.buyer.id })
        .expect(400);
    });

    it('blocks suspended sellers', async () => {
      people.seller.status = 'suspended';
      await as('seller').post('/marketplace/listings', LISTING).expect(403);
    });
  });

  describe('held for review', () => {
    it('hides a listing that mentions a prohibited item and puts it in the moderators’ queue', async () => {
      const listing = await sell({ title: 'Leaked question paper for EEE 1101' });
      expect(listing).toMatchObject({ moderated: true, heldFor: 'question paper' });
      expect(await browse()).toEqual([]);
      await as('buyer').get(`/marketplace/listings/${listing.id}`).expect(404);

      const queue = moderationQueuePageSchema.parse(
        (await as('moderator').get('/moderation/queue').expect(200)).body,
      );
      expect(queue.items[0]).toMatchObject({
        contentType: 'marketplace.listing',
        contentId: listing.id,
      });

      await as('moderator')
        .post(`/moderation/items/marketplace.listing/${listing.id}/remove`, {
          reason: 'Selling exam papers is not allowed',
        })
        .expect(200);
      const own = await as('seller').get(`/marketplace/listings/${listing.id}`).expect(200);
      expect(own.body.moderated).toBe(true);
    });

    it('publishes a held listing when a moderator restores it', async () => {
      const listing = await sell({
        title: 'Beer-making kit',
        description: 'For the chemistry club demo.',
      });
      expect(listing.moderated).toBe(true);
      await as('moderator')
        .post(`/moderation/items/marketplace.listing/${listing.id}/restore`, {
          reason: 'Lab equipment, allowed',
        })
        .expect(200);
      const items = await browse();
      expect(items.map((i) => i.id)).toEqual([listing.id]);
      expect(prisma.listings[0]?.heldTerm).toBeNull();
      // The automatic report is closed, so the queue is empty again.
      const queue = moderationQueuePageSchema.parse(
        (await as('moderator').get('/moderation/queue')).body,
      );
      expect(queue.items).toEqual([]);
    });

    it('holds an approved listing again if an edit adds a prohibited item', async () => {
      const listing = await sell();
      await as('seller')
        .patch(`/marketplace/listings/${listing.id}`, {
          ...LISTING,
          description: 'Free cigarette with it',
        })
        .expect(200);
      expect(await browse()).toEqual([]);
    });
  });

  describe('state, expiry and ownership', () => {
    it('shows reserved listings, hides sold ones from others', async () => {
      const listing = await sell();
      await as('buyer')
        .post(`/marketplace/listings/${listing.id}/state`, { state: 'sold' })
        .expect(403);
      await as('seller')
        .post(`/marketplace/listings/${listing.id}/state`, { state: 'reserved' })
        .expect(200);
      expect((await browse())[0]?.state).toBe('reserved');
      await as('seller')
        .post(`/marketplace/listings/${listing.id}/state`, { state: 'sold' })
        .expect(200);
      expect(await browse()).toEqual([]);
      await as('buyer').get(`/marketplace/listings/${listing.id}`).expect(404);
    });

    it('drops listings after 30 days until renewed', async () => {
      const listing = await sell();
      prisma.listings[0]!.expiresAt = new Date(Date.now() - 1000);
      expect(await browse()).toEqual([]);
      await as('buyer').post(`/marketplace/listings/${listing.id}/renew`).expect(403);
      await as('seller').post(`/marketplace/listings/${listing.id}/renew`).expect(200);
      expect(await browse()).toHaveLength(1);
    });

    it('only the seller edits or deletes; reported listings can be hidden', async () => {
      const listing = await sell();
      await as('buyer').patch(`/marketplace/listings/${listing.id}`, LISTING).expect(403);
      await as('buyer').delete(`/marketplace/listings/${listing.id}`).expect(403);
      await as('buyer')
        .post('/moderation/reports', {
          contentType: 'marketplace.listing',
          contentId: listing.id,
          reason: 'scam',
        })
        .expect(204);
      await as('moderator')
        .post(`/moderation/items/marketplace.listing/${listing.id}/hide`, {
          reason: 'Asked for payment in advance',
        })
        .expect(200);
      expect(await browse()).toEqual([]);
      await as('seller').delete(`/marketplace/listings/${listing.id}`).expect(204);
    });
  });
});
