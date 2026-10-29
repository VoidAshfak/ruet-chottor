import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { directoryPageSchema, type Role } from '@ruet-chottor/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const FLAGS = ['FEATURE_AUTH', 'FEATURE_USERS', 'FEATURE_DIRECTORY'];

describe('Directory (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrisma;
  let redis: FakeRedis;
  let cookie: string;

  const http = () => request(app.getHttpServer());
  const search = (query: Record<string, string | number> = {}) =>
    http().get('/api/v1/directory').query(query).set('Cookie', cookie);
  const names = (res: request.Response) =>
    directoryPageSchema.parse(res.body).items.map((item) => item.name);

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
    for (const key of redis.keys()) void redis.del(key);
    const people: [string, string, Role, ('active' | 'banned')?][] = [
      ['Arif Placeholder', '1703901', 'student'],
      ['Nusrat Example', '1701902', 'student'],
      ['Rafiq Fakeuddin', '2103903', 'student'],
      ['Hasan Mockrahman', '1203904', 'alumni'],
      ['Banned Sample', '1703905', 'student', 'banned'],
    ];
    for (const [index, [name, roll, role, status]] of people.entries()) {
      await prisma.user.create({
        data: {
          name,
          roll,
          role,
          status: status ?? 'active',
          email: `person${index}@example.com`,
          phone: `+88017000000${index}`,
        },
      });
    }
    const viewer = prisma.users[0]!;
    prisma.profiles.push({
      userId: prisma.users[1]!.id,
      showEmail: true,
      showPhone: false,
      dismissedGuides: [],
      updatedAt: new Date(),
    });
    const token = await app
      .get(AccessTokenStore)
      .issue({ userId: viewer.id, sessionId: 'test-session', role: 'student' });
    cookie = `rc_access=${token}`;
  });

  it('lists active members by name, with privacy applied', async () => {
    const res = await search().expect(200);
    expect(names(res)).toEqual([
      'Arif Placeholder',
      'Hasan Mockrahman',
      'Nusrat Example',
      'Rafiq Fakeuddin',
    ]);
    const nusrat = directoryPageSchema.parse(res.body).items[2]!;
    expect(nusrat).toMatchObject({ email: 'person1@example.com', phone: null });
    expect(nusrat.department?.short).toBe('EEE');
    expect(JSON.stringify(res.body)).not.toContain('person0@example.com');
  });

  it('searches by name or roll', async () => {
    expect(names(await search({ q: 'rafiq' }).expect(200))).toEqual(['Rafiq Fakeuddin']);
    expect(names(await search({ q: '17' }).expect(200))).toEqual([
      'Arif Placeholder',
      'Nusrat Example',
    ]);
  });

  it('filters by department, series and role', async () => {
    expect(names(await search({ department: 'CSE' }).expect(200))).toEqual([
      'Arif Placeholder',
      'Hasan Mockrahman',
      'Rafiq Fakeuddin',
    ]);
    expect(names(await search({ department: 'CSE', series: 2017 }).expect(200))).toEqual([
      'Arif Placeholder',
    ]);
    expect(names(await search({ role: 'alumni' }).expect(200))).toEqual(['Hasan Mockrahman']);
  });

  it('pages with a cursor', async () => {
    const first = directoryPageSchema.parse((await search({ limit: 3 }).expect(200)).body);
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).not.toBeNull();
    const second = directoryPageSchema.parse(
      (await search({ limit: 3, cursor: first.nextCursor! }).expect(200)).body,
    );
    expect(second.items.map((item) => item.name)).toEqual(['Rafiq Fakeuddin']);
    expect(second.nextCursor).toBeNull();
  });

  it('rejects invalid filters', async () => {
    const invalid: Record<string, string | number>[] = [
      { department: 'XYZ' },
      { series: 'abc' },
      { limit: 500 },
      { role: 'admin' },
    ];
    for (const query of invalid) {
      const res = await search(query).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('needs a login', async () => {
    const res = await http().get('/api/v1/directory').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
