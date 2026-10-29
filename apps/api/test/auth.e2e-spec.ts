import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { otpChallengeSchema, sessionResponseSchema } from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { MailService, type MailMessage } from '../src/core/mail/mail.service.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const student = {
  name: 'Test Student',
  roll: '2103001',
  registrationNo: '12345',
  email: 'test.student@example.com',
  phone: '01700000001',
  dateOfBirth: '2003-05-14',
  password: 'green-river-42',
};

/** `Set-Cookie` headers -> { name: { value, attributes } } */
function parseCookies(res: request.Response) {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return Object.fromEntries(
    (raw ?? []).map((line) => {
      const [pair = '', ...attributes] = line.split(';').map((part) => part.trim());
      const [name = '', value = ''] = pair.split('=');
      return [name, { value, attributes: attributes.map((a) => a.toLowerCase()) }];
    }),
  );
}

async function bootApp(
  prisma: FakePrisma,
  redis: FakeRedis,
  mail: MailMessage[],
): Promise<INestApplication<App>> {
  // Imported after FEATURE_AUTH is set: feature modules are chosen when AppModule loads.
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(RedisService)
    .useValue({ client: redis, health: async () => 'up' })
    .overrideProvider(MailService)
    .useValue({ send: async (message: MailMessage) => void mail.push(message) })
    .compile();
  const app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
  await app.init();
  return app;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrisma;
  let redis: FakeRedis;
  const mail: MailMessage[] = [];

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.FEATURE_AUTH = 'true';
    prisma = new FakePrisma();
    redis = new FakeRedis();
    app = await bootApp(prisma, redis, mail);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.FEATURE_AUTH;
  });

  beforeEach(() => {
    prisma.users = [];
    prisma.sessions = [];
    mail.length = 0;
    for (const key of redis.keys()) void redis.del(key);
  });

  const signup = (body: Partial<typeof student> = {}) =>
    http()
      .post('/api/v1/auth/signup')
      .send({ ...student, ...body });

  async function login() {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ roll: student.roll, password: student.password })
      .expect(200);
    const challenge = otpChallengeSchema.parse(res.body);
    const code = /code is (\d{6})/.exec(mail.at(-1)?.text ?? '')?.[1];
    expect(code).toBeDefined();
    return { challenge, code: code! };
  }

  async function fullLogin() {
    await signup().expect(201);
    const { challenge, code } = await login();
    const res = await http()
      .post('/api/v1/auth/otp/verify')
      .send({ challengeId: challenge.challengeId, code })
      .expect(200);
    const cookies = parseCookies(res);
    return {
      res,
      access: cookies.rc_access!.value,
      refresh: cookies.rc_refresh!.value,
      cookies,
    };
  }

  it('refuses state-changing requests from another origin (CSRF)', async () => {
    const res = await signup().set('Origin', 'https://evil.example.com').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    await signup().set('Origin', 'http://localhost:3000').expect(201);
  });

  describe('POST /auth/signup', () => {
    it('creates an account without returning private fields', async () => {
      const res = await signup().expect(201);
      expect(res.body).toEqual({
        user: { id: expect.any(String), name: student.name, roll: student.roll, role: 'student' },
      });
      const stored = prisma.users[0]!;
      expect(stored.phone).toBe('+8801700000001');
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('rejects invalid input with VALIDATION_FAILED', async () => {
      const res = await signup({ roll: '12' }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.message).toMatch(/^roll:/);
    });

    it('rejects a common password', async () => {
      const res = await signup({ password: 'password123' }).expect(400);
      expect(res.body.error.message).toMatch(/too common/);
    });

    it('rejects a duplicate email with 409', async () => {
      await signup().expect(201);
      const res = await signup({ roll: '2103002', registrationNo: '99999', phone: '01700000002' });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/email/);
    });
  });

  describe('POST /auth/login', () => {
    it('sends a code by email and masks the address', async () => {
      await signup().expect(201);
      const { challenge } = await login();
      expect(challenge.destination).toBe('t•••@example.com');
      expect(mail[0]?.to).toBe(student.email);
    });

    it('gives the same error for a wrong password and an unknown roll', async () => {
      await signup().expect(201);
      const wrong = await http()
        .post('/api/v1/auth/login')
        .send({ roll: student.roll, password: 'not-the-password' })
        .expect(401);
      const unknown = await http()
        .post('/api/v1/auth/login')
        .send({ roll: '2103999', password: 'not-the-password' })
        .expect(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(mail).toHaveLength(0);
    });

    it('rejects a malformed body', async () => {
      const res = await http().post('/api/v1/auth/login').send({ roll: 'abc' }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('refuses a suspended account', async () => {
      await signup().expect(201);
      prisma.users[0]!.status = 'suspended';
      const res = await http()
        .post('/api/v1/auth/login')
        .send({ roll: student.roll, password: student.password })
        .expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('rate-limits repeated attempts on one roll', async () => {
      await signup().expect(201);
      const attempt = () =>
        http().post('/api/v1/auth/login').send({ roll: student.roll, password: 'wrong-password' });
      for (let i = 0; i < 10; i += 1) await attempt().expect(401);
      const res = await attempt().expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('POST /auth/otp/verify', () => {
    it('sets httpOnly, secure, sameSite=lax session cookies', async () => {
      const { res, cookies } = await fullLogin();
      expect(sessionResponseSchema.parse(res.body).user.roll).toBe(student.roll);
      for (const name of ['rc_access', 'rc_refresh']) {
        expect(cookies[name]?.attributes).toEqual(
          expect.arrayContaining(['httponly', 'secure', 'samesite=lax']),
        );
      }
      expect(cookies.rc_refresh?.attributes).toContain('path=/api/v1/auth');
    });

    it('rejects a wrong code and says how many tries are left', async () => {
      await signup().expect(201);
      const { challenge, code } = await login();
      const res = await http()
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: challenge.challengeId, code: code === '000000' ? '111111' : '000000' })
        .expect(400);
      expect(res.body.error).toEqual({ code: 'OTP_INVALID', message: 'Wrong code. 4 tries left.' });
    });

    it('rejects an unknown challenge', async () => {
      const res = await http()
        .post('/api/v1/auth/otp/verify')
        .send({ challengeId: 'nope', code: '123456' })
        .expect(400);
      expect(res.body.error.code).toBe('OTP_EXPIRED');
    });
  });

  describe('POST /auth/otp/resend', () => {
    it('enforces the cooldown', async () => {
      await signup().expect(201);
      const { challenge } = await login();
      const res = await http()
        .post('/api/v1/auth/otp/resend')
        .send({ challengeId: challenge.challengeId })
        .expect(429);
      expect(res.body.error.message).toMatch(/wait/);
    });
  });

  describe('session lifecycle', () => {
    it('logout ends the session even with a stale refresh cookie', async () => {
      const { refresh } = await fullLogin();
      const rotated = await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rc_refresh=${refresh}`)
        .expect(200);
      const next = parseCookies(rotated);
      await http()
        .post('/api/v1/auth/logout')
        .set('Cookie', `rc_access=${next.rc_access?.value}; rc_refresh=${refresh}`)
        .expect(204);
      await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rc_refresh=${next.rc_refresh?.value}`)
        .expect(401);
    });

    it('GET /auth/session needs a valid access cookie', async () => {
      const none = await http().get('/api/v1/auth/session').expect(401);
      expect(none.body.error.code).toBe('UNAUTHORIZED');
      const bogus = await http()
        .get('/api/v1/auth/session')
        .set('Cookie', 'rc_access=bogus')
        .expect(401);
      expect(bogus.body.error.code).toBe('SESSION_EXPIRED');

      const { access } = await fullLogin();
      const res = await http()
        .get('/api/v1/auth/session')
        .set('Cookie', `rc_access=${access}`)
        .expect(200);
      expect(res.body.user.roll).toBe(student.roll);
    });

    it('refresh rotates the tokens', async () => {
      const { refresh } = await fullLogin();
      const res = await http()
        .post('/api/v1/auth/refresh')
        .set('Cookie', `rc_refresh=${refresh}`)
        .expect(200);
      const next = parseCookies(res);
      expect(next.rc_refresh?.value).not.toBe(refresh);
      await http()
        .get('/api/v1/auth/session')
        .set('Cookie', `rc_access=${next.rc_access?.value}`)
        .expect(200);
    });

    it('refresh without a cookie is 401', async () => {
      await http().post('/api/v1/auth/refresh').expect(401);
    });

    it('logout ends the session', async () => {
      const { access, refresh } = await fullLogin();
      await http()
        .post('/api/v1/auth/logout')
        .set('Cookie', `rc_access=${access}; rc_refresh=${refresh}`)
        .expect(204);
      await http().get('/api/v1/auth/session').set('Cookie', `rc_access=${access}`).expect(401);
      await http().post('/api/v1/auth/refresh').set('Cookie', `rc_refresh=${refresh}`).expect(401);
    });
  });
});
