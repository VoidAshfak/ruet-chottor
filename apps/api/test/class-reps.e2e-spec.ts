import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  classRepRequestSchema,
  classRepReviewPageSchema,
  myClassRepSchema,
  myProfileSchema,
  publicProfileSchema,
  type Role,
} from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { MailService } from '../src/core/mail/mail.service.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import type { User } from '../src/generated/prisma/client.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const FLAGS = ['FEATURE_AUTH', 'FEATURE_USERS', 'FEATURE_ADMIN', 'FEATURE_NOTIFICATIONS'];
type Person = 'student' | 'classmate' | 'alumnus' | 'unknownClass' | 'moderator';
const APPLY = { section: 'A', note: 'Chosen by our class in the first week; Dr. Example knows.' };

describe('Class representatives (e2e)', () => {
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
    delete: (path: string) => http().delete(`/api/v1${path}`).set('Cookie', cookies[who]),
  });
  const apply = async (who: Person = 'student', body: object = APPLY) =>
    myClassRepSchema.parse((await as(who).post('/users/me/class-rep', body).expect(201)).body)
      .request!;
  const queue = async (status = 'pending') =>
    classRepReviewPageSchema.parse(
      (await as('moderator').get(`/users/class-reps?status=${status}`).expect(200)).body,
    ).items;
  const badge = async (who: Person) =>
    publicProfileSchema.parse(
      (await as('classmate').get(`/users/${people[who].id}`).expect(200)).body,
    ).classRep;

  beforeAll(async () => {
    for (const flag of FLAGS) process.env[flag] = 'true';
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ client: redis, health: async () => 'up' })
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
    prisma.profiles = [];
    prisma.classRepRequests = [];
    prisma.moderationLogs = [];
    prisma.notifications = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['student', 'Demo Student', '2103045', 'student'],
      ['classmate', 'Nusrat Example', '2103046', 'student'],
      ['alumnus', 'Old Example', '1503010', 'alumni'],
      // Department code 99 does not exist, so the class cannot be worked out.
      ['unknownClass', 'Odd Example', '2199001', 'student'],
      ['moderator', 'Demo Moderator', '2001020', 'moderator'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: {
          name,
          roll,
          role,
          email: `cr${index}@example.com`,
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

  describe('access and validation', () => {
    it('needs a login', async () => {
      await http().get('/api/v1/users/me/class-rep').expect(401);
      await http().post('/api/v1/users/me/class-rep').send(APPLY).expect(401);
      await http().get('/api/v1/users/class-reps').expect(401);
    });

    it('validates the request', async () => {
      await as('student')
        .post('/users/me/class-rep', { ...APPLY, section: 'Z' })
        .expect(400);
      await as('student')
        .post('/users/me/class-rep', { ...APPLY, note: 'trust me' })
        .expect(400);
      await as('student')
        .post('/users/me/class-rep', { ...APPLY, userId: people.classmate.id })
        .expect(400);
    });

    it('keeps reviews for staff, and /users/class-reps is not read as a member id', async () => {
      await as('student').get('/users/class-reps').expect(403);
      const mine = await apply();
      await as('classmate').post(`/users/class-reps/${mine.id}/approve`).expect(403);
      expect(await queue()).toHaveLength(1);
      await as('moderator').post('/users/class-reps/not-an-id/approve').expect(400);
    });

    it('is only for current students with a known class', async () => {
      await as('alumnus').post('/users/me/class-rep', APPLY).expect(403);
      await as('unknownClass').post('/users/me/class-rep', APPLY).expect(400);
    });

    it('blocks suspended members', async () => {
      people.student.status = 'suspended';
      const res = await as('student').post('/users/me/class-rep', APPLY).expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('asking', () => {
    it('starts pending, visible to the student, and only one at a time', async () => {
      const mine = await apply();
      expect(mine).toMatchObject({ status: 'pending', section: 'A', reviewNote: null });
      const got = myClassRepSchema.parse((await as('student').get('/users/me/class-rep')).body);
      expect(got.request?.id).toBe(mine.id);
      const again = await as('student').post('/users/me/class-rep', APPLY).expect(409);
      expect(again.body.error.code).toBe('CONFLICT');
      expect(await badge('student')).toBeNull();
    });

    it('accepts a class without sections', async () => {
      expect((await apply('student', { ...APPLY, section: null })).section).toBeNull();
    });

    it('can be withdrawn while pending, then asked again', async () => {
      await apply();
      const res = myClassRepSchema.parse(
        (await as('student').delete('/users/me/class-rep').expect(200)).body,
      );
      expect(res.request?.status).toBe('withdrawn');
      expect(await queue()).toEqual([]);
      await apply();
    });
  });

  describe('review', () => {
    it('approval adds the badge, logs it and tells the student', async () => {
      const mine = await apply();
      const item = (await queue())[0]!;
      expect(item.user).toMatchObject({
        id: people.student.id,
        department: { short: 'CSE' },
        series: 2021,
      });
      expect(item.note).toBe(APPLY.note);

      const approved = classRepRequestSchema.parse(
        (await as('moderator').post(`/users/class-reps/${mine.id}/approve`).expect(200)).body,
      );
      expect(approved.status).toBe('approved');
      expect(await badge('student')).toMatchObject({ section: 'A' });
      const me = myProfileSchema.parse((await as('student').get('/users/me')).body);
      expect(me.classRep?.section).toBe('A');
      expect(prisma.moderationLogs[0]).toMatchObject({
        action: 'verify_class_rep',
        targetUserId: people.student.id,
        moderatorId: people.moderator.id,
      });
      expect(prisma.notifications[0]).toMatchObject({
        userId: people.student.id,
        type: 'users.class_rep_approved',
      });
      expect((await queue('approved')).map((r) => r.id)).toEqual([mine.id]);
      // Already decided: a second approval finds nothing to decide.
      await as('moderator').post(`/users/class-reps/${mine.id}/approve`).expect(404);
    });

    it('rejection needs a reason, which the student sees; they can ask again', async () => {
      const mine = await apply();
      await as('moderator').post(`/users/class-reps/${mine.id}/reject`, {}).expect(400);
      await as('moderator')
        .post(`/users/class-reps/${mine.id}/reject`, {
          reason: 'No one from your class confirmed this.',
        })
        .expect(200);
      const got = myClassRepSchema.parse((await as('student').get('/users/me/class-rep')).body);
      expect(got.request).toMatchObject({
        status: 'rejected',
        reviewNote: 'No one from your class confirmed this.',
      });
      expect(prisma.moderationLogs[0]?.action).toBe('reject_class_rep');
      expect(await badge('student')).toBeNull();
      await apply();
    });

    it('staff can revoke, which removes the badge', async () => {
      const mine = await apply();
      await as('moderator').post(`/users/class-reps/${mine.id}/approve`).expect(200);
      await as('moderator')
        .post(`/users/class-reps/${mine.id}/revoke`, { reason: 'The class chose a new CR.' })
        .expect(200);
      expect(await badge('student')).toBeNull();
      expect(prisma.moderationLogs.map((l) => l.action)).toContain('revoke_class_rep');
      expect(prisma.notifications.at(-1)?.type).toBe('users.class_rep_revoked');
    });

    it('a CR can step down', async () => {
      const mine = await apply();
      await as('moderator').post(`/users/class-reps/${mine.id}/approve`).expect(200);
      const res = myClassRepSchema.parse(
        (await as('student').delete('/users/me/class-rep').expect(200)).body,
      );
      expect(res.request?.status).toBe('revoked');
      expect(await badge('student')).toBeNull();
      await as('student').delete('/users/me/class-rep').expect(404);
    });

    it('staff cannot approve their own request', async () => {
      const mine = await apply('moderator');
      await as('moderator').post(`/users/class-reps/${mine.id}/approve`).expect(403);
    });
  });
});
