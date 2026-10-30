import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  clubDetailSchema,
  clubMemberPageSchema,
  clubPageSchema,
  newsPageSchema,
  newsPostSchema,
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

const FLAGS = [
  'FEATURE_AUTH',
  'FEATURE_ADMIN',
  'FEATURE_CLUBS',
  'FEATURE_NEWS',
  'FEATURE_MODERATION',
];
type Person = 'admin' | 'manager' | 'student' | 'other';
const CLUB = {
  name: 'Robotics Club (demo)',
  tagline: 'Build robots, learn embedded systems.',
  category: 'technical',
  about: 'Weekly workshops and contests.',
};
const PROFILE = {
  tagline: 'Robots every Thursday',
  category: 'technical',
  about: 'Weekly workshops, contests and an annual expo.',
  contactEmail: 'robotics@example.com',
  links: [{ label: 'Facebook page', url: 'https://example.com/robotics' }],
  logoId: null,
  coverId: null,
};

describe('Clubs (e2e)', () => {
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
    put: (path: string, body: object) =>
      http().put(`/api/v1${path}`).set('Cookie', cookies[who]).send(body),
    delete: (path: string) => http().delete(`/api/v1${path}`).set('Cookie', cookies[who]),
  });
  const createClub = async () =>
    clubDetailSchema.parse(
      (
        await as('admin')
          .post('/clubs', { ...CLUB, managerIds: [people.manager.id] })
          .expect(201)
      ).body,
    );

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
    prisma.clubs = [];
    prisma.clubMemberships = [];
    prisma.moderationLogs = [];
    prisma.newsPosts = [];
    prisma.mediaAssets = [];
    prisma.reports = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['admin', 'Demo Admin', '0000001', 'admin'],
      ['manager', 'Sadia Sample', '2202904', 'student'],
      ['student', 'Demo Student', '1703999', 'student'],
      ['other', 'Nusrat Example', '2101902', 'student'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: {
          name,
          roll,
          role,
          email: `club${index}@example.com`,
          phone: `+8801744444${index}44`,
        },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
  });

  describe('admins', () => {
    it('needs a login, and only admins create clubs', async () => {
      await http().get('/api/v1/clubs').expect(401);
      await as('student')
        .post('/clubs', { ...CLUB, managerIds: [people.student.id] })
        .expect(403);
    });

    it('creates a club, appoints its manager and logs the role change', async () => {
      const club = await createClub();
      expect(club).toMatchObject({
        slug: 'robotics-club-demo',
        managers: [{ name: 'Sadia Sample' }],
      });
      expect(people.manager.role).toBe('club_manager');
      expect(prisma.moderationLogs[0]).toMatchObject({
        action: 'change_role',
        targetUserId: people.manager.id,
        details: { from: 'student', to: 'club_manager' },
      });
    });

    it('validates and refuses duplicate names', async () => {
      await as('admin')
        .post('/clubs', { ...CLUB, managerIds: [] })
        .expect(400);
      await as('admin')
        .post('/clubs', { ...CLUB, category: 'parties', managerIds: [people.manager.id] })
        .expect(400);
      await createClub();
      await as('admin')
        .post('/clubs', { ...CLUB, managerIds: [people.manager.id] })
        .expect(409);
    });

    it('replaces the managers; former managers stay as members', async () => {
      const club = await createClub();
      const res = await as('admin')
        .put(`/clubs/${club.id}/managers`, { userIds: [people.other.id] })
        .expect(200);
      expect(clubDetailSchema.parse(res.body).managers.map((m) => m.name)).toEqual([
        'Nusrat Example',
      ]);
      const members = clubMemberPageSchema.parse(
        (await as('other').get(`/clubs/${club.id}/members`)).body,
      );
      expect(members.items.map((m) => [m.name, m.clubRole])).toEqual([
        ['Nusrat Example', 'manager'],
        ['Sadia Sample', 'member'],
      ]);
    });
  });

  describe('managers', () => {
    it('edit the page but cannot rename; others cannot edit', async () => {
      const club = await createClub();
      const res = await as('manager').patch(`/clubs/${club.id}`, PROFILE).expect(200);
      expect(res.body).toMatchObject({
        tagline: 'Robots every Thursday',
        contactEmail: 'robotics@example.com',
      });
      await as('manager')
        .patch(`/clubs/${club.id}`, { ...PROFILE, name: 'Hijacked' })
        .expect(403);
      await as('student').patch(`/clubs/${club.id}`, PROFILE).expect(403);
      await as('manager')
        .patch(`/clubs/${club.id}`, {
          ...PROFILE,
          links: [{ label: 'x', url: 'javascript:alert(1)' }],
        })
        .expect(400);
    });

    it('approve join requests; requests are private to managers', async () => {
      const club = await createClub();
      await as('student').post(`/clubs/${club.id}/membership`).expect(201);
      await as('student').post(`/clubs/${club.id}/membership`).expect(409);
      await as('other').get(`/clubs/${club.id}/members?state=pending`).expect(403);

      const pending = clubMemberPageSchema.parse(
        (await as('manager').get(`/clubs/${club.id}/members?state=pending`).expect(200)).body,
      );
      expect(pending.items.map((m) => m.name)).toEqual(['Demo Student']);
      await as('other').post(`/clubs/${club.id}/members/${people.student.id}/approve`).expect(403);
      await as('manager')
        .post(`/clubs/${club.id}/members/${people.student.id}/approve`)
        .expect(204);

      const detail = clubDetailSchema.parse((await as('student').get(`/clubs/${club.slug}`)).body);
      expect(detail).toMatchObject({
        memberCount: 2,
        myMembership: { role: 'member', state: 'active' },
      });
    });

    it('remove members but not other managers; the last manager cannot leave', async () => {
      const club = await createClub();
      await as('student').post(`/clubs/${club.id}/membership`).expect(201);
      await as('manager').delete(`/clubs/${club.id}/members/${people.student.id}`).expect(204);
      await as('manager').delete(`/clubs/${club.id}/membership`).expect(400);
    });
  });

  describe('members', () => {
    it('lists and searches visible clubs', async () => {
      await createClub();
      const all = clubPageSchema.parse((await as('student').get('/clubs')).body);
      expect(all.items.map((c) => c.name)).toEqual(['Robotics Club (demo)']);
      const none = clubPageSchema.parse((await as('student').get('/clubs?q=debate')).body);
      expect(none.items).toEqual([]);
      await as('student').get('/clubs?category=parties').expect(400);
    });

    it('cannot see a club hidden by moderators, but its manager can', async () => {
      const club = await createClub();
      prisma.clubs[0]!.status = 'hidden';
      await as('student').get(`/clubs/${club.slug}`).expect(404);
      await as('student').post(`/clubs/${club.id}/membership`).expect(404);
      const own = await as('manager').get(`/clubs/${club.slug}`).expect(200);
      expect(own.body.moderated).toBe(true);
    });

    it('suspended members cannot join', async () => {
      const club = await createClub();
      people.student.status = 'suspended';
      await as('student').post(`/clubs/${club.id}/membership`).expect(403);
    });
  });

  describe('news for a club', () => {
    const POST = {
      title: 'Robotics workshop on Thursday',
      category: 'club',
      body: 'Bring your laptops; we will build a line follower together.',
    };

    it('lets the club’s managers post as the club, and filters the feed by club', async () => {
      const club = await createClub();
      const post = newsPostSchema.parse(
        (
          await as('manager')
            .post('/news', { ...POST, clubId: club.id })
            .expect(201)
        ).body,
      );
      expect(post).toMatchObject({ review: 'approved', club: { slug: club.slug } });
      const feed = newsPageSchema.parse((await as('student').get(`/news?clubId=${club.id}`)).body);
      expect(feed.items.map((p) => p.id)).toEqual([post.id]);
    });

    it('refuses posting for a club you do not manage', async () => {
      const club = await createClub();
      const res = await as('student')
        .post('/news', { ...POST, clubId: club.id })
        .expect(400);
      expect(res.body.error.message).toMatch(/clubs you manage/);
    });
  });
});
