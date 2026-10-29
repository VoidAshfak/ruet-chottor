import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  dismissedGuidesResponseSchema,
  myProfileSchema,
  publicProfileSchema,
} from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import type { User } from '../src/generated/prisma/client.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrisma;
  let redis: FakeRedis;
  let me: User;
  let other: User;
  let cookie: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.FEATURE_AUTH = 'true';
    process.env.FEATURE_USERS = 'true';
    prisma = new FakePrisma();
    redis = new FakeRedis();
    // Imported after the flags are set: feature modules are chosen when AppModule loads.
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ client: redis, health: async () => 'up' })
      .compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.FEATURE_AUTH;
    delete process.env.FEATURE_USERS;
  });

  beforeEach(async () => {
    prisma.users = [];
    prisma.profiles = [];
    for (const key of redis.keys()) void redis.del(key);
    const person = (name: string, roll: string, n: number) =>
      prisma.user.create({
        data: {
          name,
          roll,
          registrationNo: `1000${n}`,
          email: `person${n}@example.com`,
          phone: `+88017000000${n}`,
          dateOfBirth: new Date('2003-05-14'),
          passwordHash: '$argon2id$not-a-real-hash',
        },
      });
    me = await person('Test Student', '1703103', 1);
    other = await person('Other Student', '2100045', 2);
    // Skip the two-step login: auth has its own e2e tests.
    const token = await app
      .get(AccessTokenStore)
      .issue({ userId: me.id, sessionId: 'test-session', role: 'student' });
    cookie = `rc_access=${token}`;
  });

  describe('GET /users/me', () => {
    it('returns my profile with my own contact details', async () => {
      const res = await http().get('/api/v1/users/me').set('Cookie', cookie).expect(200);
      const profile = myProfileSchema.parse(res.body);
      expect(profile).toMatchObject({
        roll: '1703103',
        series: 2017,
        email: 'person1@example.com',
        showEmail: false,
        showPhone: false,
      });
      expect(profile.department?.short).toBe('CSE');
      expect(res.body).not.toHaveProperty('dateOfBirth');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('needs a login', async () => {
      const res = await http().get('/api/v1/users/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /users/me', () => {
    it('updates my privacy settings', async () => {
      const res = await http()
        .patch('/api/v1/users/me')
        .set('Cookie', cookie)
        .send({ showPhone: true })
        .expect(200);
      expect(myProfileSchema.parse(res.body)).toMatchObject({ showPhone: true, showEmail: false });
    });

    it('rejects unknown or invalid fields', async () => {
      const unknown = await http()
        .patch('/api/v1/users/me')
        .set('Cookie', cookie)
        .send({ name: 'New Name' })
        .expect(400);
      expect(unknown.body.error.code).toBe('VALIDATION_FAILED');
      await http()
        .patch('/api/v1/users/me')
        .set('Cookie', cookie)
        .send({ showPhone: 'yes' })
        .expect(400);
      await http().patch('/api/v1/users/me').set('Cookie', cookie).send({}).expect(400);
    });

    it('needs a login', async () => {
      await http().patch('/api/v1/users/me').send({ showPhone: true }).expect(401);
    });
  });

  describe('GET /users/:id', () => {
    it('applies the owner’s privacy settings', async () => {
      prisma.profiles.push({
        userId: other.id,
        showEmail: true,
        showPhone: false,
        dismissedGuides: ['home'],
        updatedAt: new Date(),
      });
      const res = await http().get(`/api/v1/users/${other.id}`).set('Cookie', cookie).expect(200);
      expect(publicProfileSchema.strict().parse(res.body)).toMatchObject({
        name: 'Other Student',
        department: { short: 'CE' },
        series: 2021,
        email: 'person2@example.com',
        phone: null,
      });
    });

    it('returns 404 for a banned member', async () => {
      other.status = 'banned';
      const res = await http().get(`/api/v1/users/${other.id}`).set('Cookie', cookie).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects a malformed id', async () => {
      const res = await http().get('/api/v1/users/not-an-id').set('Cookie', cookie).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('needs a login', async () => {
      await http().get(`/api/v1/users/${other.id}`).expect(401);
    });
  });

  describe('/users/me/guides', () => {
    it('remembers dismissed guides and resets them', async () => {
      const dismissed = await http()
        .patch('/api/v1/users/me/guides')
        .set('Cookie', cookie)
        .send({ moduleKey: 'home' })
        .expect(200);
      expect(dismissedGuidesResponseSchema.parse(dismissed.body).dismissedGuides).toEqual(['home']);

      const reset = await http()
        .delete('/api/v1/users/me/guides')
        .set('Cookie', cookie)
        .expect(200);
      expect(reset.body).toEqual({ dismissedGuides: [] });
    });

    it('rejects an invalid guide key', async () => {
      const res = await http()
        .patch('/api/v1/users/me/guides')
        .set('Cookie', cookie)
        .send({ moduleKey: '../../etc' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('needs a login', async () => {
      await http().patch('/api/v1/users/me/guides').send({ moduleKey: 'home' }).expect(401);
      await http().delete('/api/v1/users/me/guides').expect(401);
    });
  });
});
