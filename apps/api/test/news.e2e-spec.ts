import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  mediaAssetSchema,
  newsPageSchema,
  newsPostSchema,
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

const FLAGS = ['FEATURE_AUTH', 'FEATURE_ADMIN', 'FEATURE_NEWS', 'FEATURE_MODERATION'];
type Person = 'student' | 'other' | 'clubManager' | 'moderator';
const POST = {
  title: 'Robotics club meets on Thursday',
  category: 'club',
  body: 'Bring your laptops. We will plan the line-follower contest for next month.',
};

describe('News (e2e)', () => {
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
  const create = async (who: Person, body: object = POST) =>
    newsPostSchema.parse((await as(who).post('/news', body).expect(201)).body);
  const feed = async (who: Person = 'other') =>
    newsPageSchema.parse((await as(who).get('/news').expect(200)).body).items;
  /** A photo uploaded through the real media flow (with the fake Cloudinary). */
  const photo = async (who: Person) => {
    const ticket = uploadTicketSchema.parse(
      (
        await as(who)
          .post('/media/uploads', {
            purpose: 'news.post',
            kind: 'image',
            fileName: 'poster.jpg',
            bytes: 5000,
          })
          .expect(201)
      ).body,
    );
    cloudinary.uploaded.set(ticket.fields.public_id!, {
      format: 'jpg',
      bytes: 5000,
      width: 800,
      height: 600,
    });
    return mediaAssetSchema.parse(
      (await as(who).post(`/media/uploads/${ticket.assetId}/complete`).expect(200)).body,
    );
  };

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
    prisma.newsPosts = [];
    prisma.mediaAssets = [];
    prisma.moderationLogs = [];
    prisma.reports = [];
    cloudinary.uploaded.clear();
    cloudinary.destroyed = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['student', 'Demo Student', '1703999', 'student'],
      ['other', 'Nusrat Example', '2101902', 'student'],
      ['clubManager', 'Demo Club Manager', '0000003', 'club_manager'],
      ['moderator', 'Demo Moderator', '0000002', 'moderator'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: {
          name,
          roll,
          role,
          email: `news${index}@example.com`,
          phone: `+8801733333${index}33`,
        },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
  });

  describe('access and validation', () => {
    it('needs a login', async () => {
      await http().get('/api/v1/news').expect(401);
      await http().post('/api/v1/news').send(POST).expect(401);
    });

    it('validates posts', async () => {
      await as('student')
        .post('/news', { ...POST, title: 'Hi' })
        .expect(400);
      await as('student')
        .post('/news', { ...POST, category: 'gossip' })
        .expect(400);
      await as('student')
        .post('/news', { ...POST, body: 'too short' })
        .expect(400);
      await as('student')
        .post('/news', { ...POST, createdById: people.other.id })
        .expect(400);
    });

    it('blocks suspended members', async () => {
      people.student.status = 'suspended';
      const res = await as('student').post('/news', POST).expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('keeps the review queue for staff', async () => {
      await as('student').get('/news/review').expect(403);
      const post = await create('student');
      await as('other').post(`/news/${post.id}/approve`).expect(403);
    });
  });

  describe('publishing', () => {
    it('publishes verified authors at once', async () => {
      const post = await create('clubManager');
      expect(post).toMatchObject({ review: 'approved', author: { role: 'club_manager' } });
      expect(post.publishedAt).not.toBeNull();
      expect((await feed()).map((p) => p.id)).toEqual([post.id]);
    });

    it('holds other posts for review, visible only to the author and staff', async () => {
      const post = await create('student');
      expect(post.review).toBe('pending');
      expect(await feed()).toEqual([]);
      await as('other').get(`/news/${post.id}`).expect(404);
      await as('student').get(`/news/${post.id}`).expect(200);
      await as('moderator').get(`/news/${post.id}`).expect(200);
      const mine = newsPageSchema.parse((await as('student').get('/news/mine')).body);
      expect(mine.items[0]?.review).toBe('pending');
    });

    it('a moderator approves, which publishes and logs it', async () => {
      const post = await create('student');
      const queue = newsPageSchema.parse((await as('moderator').get('/news/review')).body);
      expect(queue.items.map((p) => p.id)).toEqual([post.id]);
      await as('moderator').post(`/news/${post.id}/approve`, {}).expect(200);
      expect((await feed()).map((p) => p.id)).toEqual([post.id]);
      expect(prisma.moderationLogs[0]).toMatchObject({
        action: 'approve_content',
        contentType: 'news.post',
        targetUserId: people.student.id,
      });
    });

    it('a rejection needs a reason, which only the author sees', async () => {
      const post = await create('student');
      await as('moderator').post(`/news/${post.id}/reject`, { reason: '' }).expect(400);
      await as('moderator')
        .post(`/news/${post.id}/reject`, { reason: 'Please add the venue and time.' })
        .expect(200);
      const mine = newsPageSchema.parse((await as('student').get('/news/mine')).body);
      expect(mine.items[0]).toMatchObject({
        review: 'rejected',
        reviewNote: 'Please add the venue and time.',
      });
      expect(await feed()).toEqual([]);
    });

    it('sends an edited post of an unverified author back to review', async () => {
      const post = await create('student');
      await as('moderator').post(`/news/${post.id}/approve`, {}).expect(200);
      const edited = await as('student')
        .patch(`/news/${post.id}`, { ...POST, body: `${POST.body} Updated: room 301.` })
        .expect(200);
      expect(edited.body.review).toBe('pending');
      expect(await feed()).toEqual([]);
    });

    it('only the author edits or deletes', async () => {
      const post = await create('clubManager');
      await as('other').patch(`/news/${post.id}`, POST).expect(403);
      await as('other').delete(`/news/${post.id}`).expect(403);
      await as('clubManager').delete(`/news/${post.id}`).expect(204);
      expect(await feed()).toEqual([]);
      await as('clubManager').get(`/news/${post.id}`).expect(404);
    });

    it('filters the feed by category', async () => {
      await create('clubManager');
      await create('clubManager', { ...POST, category: 'academic', title: 'Exam routine out' });
      const res = await as('other').get('/news?category=academic').expect(200);
      expect(newsPageSchema.parse(res.body).items.map((p) => p.title)).toEqual([
        'Exam routine out',
      ]);
    });
  });

  describe('photos', () => {
    it('attaches the author’s own uploads, and deletes them with the post', async () => {
      const image = await photo('clubManager');
      const post = await create('clubManager', { ...POST, mediaIds: [image.id] });
      expect(post.media.map((m) => m.id)).toEqual([image.id]);
      await as('clubManager').delete(`/news/${post.id}`).expect(204);
      expect(prisma.mediaAssets).toHaveLength(0);
      expect(cloudinary.destroyed).toHaveLength(1);
    });

    it('refuses someone else’s upload', async () => {
      const theirs = await photo('other');
      await as('clubManager')
        .post('/news', { ...POST, mediaIds: [theirs.id] })
        .expect(400);
    });
  });

  describe('moderation', () => {
    it('reported posts can be hidden from the feed', async () => {
      const post = await create('clubManager');
      await as('other')
        .post('/moderation/reports', {
          contentType: 'news.post',
          contentId: post.id,
          reason: 'misinformation',
        })
        .expect(204);
      await as('moderator')
        .post(`/moderation/items/news.post/${post.id}/hide`, { reason: 'Wrong exam dates' })
        .expect(200);
      expect(await feed()).toEqual([]);
      const own = await as('clubManager').get(`/news/${post.id}`).expect(200);
      expect(own.body.moderated).toBe(true);
    });

    it('pending posts cannot be reported (nobody else can see them)', async () => {
      const post = await create('student');
      await as('other')
        .post('/moderation/reports', {
          contentType: 'news.post',
          contentId: post.id,
          reason: 'spam',
        })
        .expect(404);
    });
  });
});
