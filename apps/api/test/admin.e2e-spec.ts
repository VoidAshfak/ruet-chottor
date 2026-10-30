import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  adminUserDetailSchema,
  adminUserPageSchema,
  moderationLogPageSchema,
  type Role,
} from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { MailService, type MailMessage } from '../src/core/mail/mail.service.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import type { User } from '../src/generated/prisma/client.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const FLAGS = ['FEATURE_AUTH', 'FEATURE_ADMIN'];
const REASON = 'Posting spam links in groups';

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrisma;
  let redis: FakeRedis;
  const mail: MailMessage[] = [];
  const people: Record<'admin' | 'moderator' | 'otherModerator' | 'student' | 'target', User> =
    {} as never;
  const cookies: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: keyof typeof people) => ({
    get: (path: string) => http().get(`/api/v1/admin${path}`).set('Cookie', cookies[who]!),
    post: (path: string, body: object) =>
      http().post(`/api/v1/admin${path}`).set('Cookie', cookies[who]!).send(body),
    patch: (path: string, body: object) =>
      http().patch(`/api/v1/admin${path}`).set('Cookie', cookies[who]!).send(body),
  });

  beforeAll(async () => {
    for (const flag of FLAGS) process.env[flag] = 'true';
    prisma = new FakePrisma();
    redis = new FakeRedis();
    // Imported after the flags are set: feature modules are chosen when AppModule loads.
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ client: redis, health: async () => 'up' })
      .overrideProvider(MailService)
      .useValue({ send: async (message: MailMessage) => void mail.push(message) })
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
    prisma.sessions = [];
    prisma.moderationLogs = [];
    mail.length = 0;
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [keyof typeof people, string, string, Role][] = [
      ['admin', 'Demo Admin', '0000001', 'admin'],
      ['moderator', 'Demo Moderator', '0000002', 'moderator'],
      ['otherModerator', 'Other Moderator', '0000005', 'moderator'],
      ['student', 'Demo Student', '1703999', 'student'],
      ['target', 'Spammy Sample', '2103908', 'student'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: {
          name,
          roll,
          role,
          email: `person${index}@example.com`,
          phone: `+8801700000${index}0`,
        },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `session-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
  });

  describe('access', () => {
    it('needs a login', async () => {
      const res = await http().get('/api/v1/admin/users').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('refuses normal members with 403', async () => {
      await as('student').get('/users').expect(403);
      await as('student').post(`/users/${people.target.id}/warn`, { reason: REASON }).expect(403);
      await as('student').get('/log').expect(403);
    });

    it('re-checks the role in the database, not only the access token', async () => {
      people.moderator.role = 'student'; // demoted after the token was issued
      const res = await as('moderator')
        .post(`/users/${people.target.id}/warn`, { reason: REASON })
        .expect(403);
      expect(res.body.error.message).toMatch(/permission/);
    });
  });

  describe('GET /admin/users', () => {
    it('lists every member, including suspended ones, without contact details', async () => {
      people.target.status = 'suspended';
      const res = await as('moderator').get('/users').expect(200);
      const page = adminUserPageSchema.parse(res.body);
      expect(page.items).toHaveLength(5);
      expect(JSON.stringify(res.body)).not.toContain('@example.com');
      const filtered = await as('moderator').get('/users?status=suspended').expect(200);
      expect(adminUserPageSchema.parse(filtered.body).items.map((u) => u.name)).toEqual([
        'Spammy Sample',
      ]);
    });

    it('rejects invalid filters', async () => {
      const res = await as('moderator').get('/users?status=deleted').expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /admin/users/:id/warn', () => {
    it('logs the warning and emails the member', async () => {
      const res = await as('moderator')
        .post(`/users/${people.target.id}/warn`, { reason: REASON })
        .expect(200);
      const detail = adminUserDetailSchema.parse(res.body);
      expect(detail.user.status).toBe('active');
      expect(detail.history[0]).toMatchObject({
        action: 'warn_user',
        reason: REASON,
        moderator: { name: 'Demo Moderator' },
      });
      expect(mail[0]).toMatchObject({ to: 'person4@example.com' });
      expect(mail[0]?.text).toContain(REASON);
    });

    it('needs a real reason', async () => {
      const res = await as('moderator')
        .post(`/users/${people.target.id}/warn`, { reason: 'no' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(prisma.moderationLogs).toHaveLength(0);
    });

    it('returns 404 for an unknown member and 400 for a malformed id', async () => {
      await as('moderator')
        .post('/users/0192d4a0-0000-7000-8000-00000000dead/warn', { reason: REASON })
        .expect(404);
      await as('moderator').post('/users/nope/warn', { reason: REASON }).expect(400);
    });
  });

  describe('POST /admin/users/:id/suspend', () => {
    it('suspends for N days, ends all sessions and logs it', async () => {
      await prisma.session.create({ data: { userId: people.target.id, refreshTokenHash: 'h1' } });
      const res = await as('moderator')
        .post(`/users/${people.target.id}/suspend`, { reason: REASON, days: 7 })
        .expect(200);
      const detail = adminUserDetailSchema.parse(res.body);
      expect(detail.user.status).toBe('suspended');
      const days = (Date.parse(detail.user.suspendedUntil!) - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.9);
      expect(prisma.sessions[0]?.revokedAt).toBeInstanceOf(Date);
      expect(detail.history[0]).toMatchObject({ action: 'suspend_user', details: { days: 7 } });
      expect(mail[0]?.subject).toMatch(/suspended/);
    });

    it('rejects out-of-range durations', async () => {
      for (const days of [0, 91]) {
        await as('moderator')
          .post(`/users/${people.target.id}/suspend`, { reason: REASON, days })
          .expect(400);
      }
    });
  });

  describe('POST /admin/users/:id/ban and /reinstate', () => {
    it('bans, refuses a second ban, then reinstates', async () => {
      await as('moderator').post(`/users/${people.target.id}/ban`, { reason: REASON }).expect(200);
      expect(people.target.status).toBe('banned');
      const again = await as('moderator')
        .post(`/users/${people.target.id}/ban`, { reason: REASON })
        .expect(409);
      expect(again.body.error.code).toBe('CONFLICT');

      const res = await as('moderator')
        .post(`/users/${people.target.id}/reinstate`, { reason: 'Appeal accepted by the team' })
        .expect(200);
      expect(adminUserDetailSchema.parse(res.body).history.map((e) => e.action)).toEqual([
        'reinstate_user',
        'ban_user',
      ]);
      expect(people.target.status).toBe('active');
    });

    it('refuses to reinstate an active member', async () => {
      await as('moderator')
        .post(`/users/${people.target.id}/reinstate`, { reason: REASON })
        .expect(409);
    });
  });

  describe('safety rules', () => {
    it('nobody can act on their own account', async () => {
      const res = await as('admin')
        .post(`/users/${people.admin.id}/ban`, { reason: REASON })
        .expect(403);
      expect(res.body.error.message).toMatch(/own account/);
    });

    it('a moderator cannot act on another moderator or an admin', async () => {
      await as('moderator')
        .post(`/users/${people.otherModerator.id}/suspend`, { reason: REASON, days: 3 })
        .expect(403);
      await as('moderator').post(`/users/${people.admin.id}/warn`, { reason: REASON }).expect(403);
      // An admin can.
      await as('admin')
        .post(`/users/${people.otherModerator.id}/warn`, { reason: REASON })
        .expect(200);
    });
  });

  describe('PATCH /admin/users/:id/role', () => {
    it('lets an admin change a role and logs from/to', async () => {
      const res = await as('admin')
        .patch(`/users/${people.student.id}/role`, {
          role: 'club_manager',
          reason: 'Runs the robotics club',
        })
        .expect(200);
      const detail = adminUserDetailSchema.parse(res.body);
      expect(detail.user.role).toBe('club_manager');
      expect(detail.history[0]).toMatchObject({
        action: 'change_role',
        details: { from: 'student', to: 'club_manager' },
      });
    });

    it('is admin-only', async () => {
      await as('moderator')
        .patch(`/users/${people.student.id}/role`, { role: 'moderator', reason: REASON })
        .expect(403);
    });

    it('rejects an unknown role', async () => {
      await as('admin')
        .patch(`/users/${people.student.id}/role`, { role: 'superuser', reason: REASON })
        .expect(400);
    });
  });

  describe('GET /admin/log', () => {
    it('lists every action, newest first, with cursor paging', async () => {
      await as('moderator').post(`/users/${people.target.id}/warn`, { reason: REASON }).expect(200);
      await as('moderator')
        .post(`/users/${people.student.id}/warn`, { reason: REASON })
        .expect(200);
      await as('moderator').post(`/users/${people.target.id}/ban`, { reason: REASON }).expect(200);

      const first = moderationLogPageSchema.parse(
        (await as('moderator').get('/log?limit=2').expect(200)).body,
      );
      expect(first.items.map((e) => e.action)).toEqual(['ban_user', 'warn_user']);
      const second = moderationLogPageSchema.parse(
        (await as('moderator').get(`/log?limit=2&cursor=${first.nextCursor}`).expect(200)).body,
      );
      expect(second.items.map((e) => e.targetUser?.name)).toEqual(['Spammy Sample']);
      expect(second.nextCursor).toBeNull();
    });
  });
});
