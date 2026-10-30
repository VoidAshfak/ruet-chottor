import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  busNoticeListSchema,
  busRouteListSchema,
  busRouteSchema,
  dhakaDateKey,
  type Role,
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

const FLAGS = ['FEATURE_AUTH', 'FEATURE_BUS'];
type Person = 'admin' | 'moderator' | 'student';
const DAY_MS = 24 * 60 * 60 * 1000;
const ROUTE = {
  name: 'Route A (demo)',
  description: 'Campus to the railway station.',
  color: 'blue',
  active: true,
  stops: [
    { name: 'Campus', minutesFromCampus: 0 },
    { name: 'Talaimari', minutesFromCampus: 10 },
    { name: 'Railway station', minutesFromCampus: 30 },
  ],
  trips: [
    { direction: 'to_campus', departsAt: '07:30', days: [0, 1, 2, 3, 4, 6], note: null },
    { direction: 'from_campus', departsAt: '16:00', days: [0, 1, 2, 3, 4, 6], note: '' },
  ],
};

describe('Bus (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new FakePrisma();
  const redis = new FakeRedis();
  const people = {} as Record<Person, User>;
  const cookies = {} as Record<Person, string>;

  const http = () => request(app.getHttpServer());
  const as = (who: Person) => ({
    get: (path: string) => http().get(`/api/v1/bus${path}`).set('Cookie', cookies[who]),
    post: (path: string, body: object) =>
      http().post(`/api/v1/bus${path}`).set('Cookie', cookies[who]).send(body),
    put: (path: string, body: object) =>
      http().put(`/api/v1/bus${path}`).set('Cookie', cookies[who]).send(body),
    delete: (path: string) => http().delete(`/api/v1/bus${path}`).set('Cookie', cookies[who]),
  });
  const create = async (body: object = ROUTE) =>
    busRouteSchema.parse((await as('admin').post('/routes', body).expect(201)).body);

  beforeAll(async () => {
    for (const flag of FLAGS) process.env[flag] = 'true';
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
    prisma.busRoutes = [];
    prisma.busStops = [];
    prisma.busTrips = [];
    prisma.busNotices = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['admin', 'Demo Admin', '0000001', 'admin'],
      ['moderator', 'Demo Moderator', '0000002', 'moderator'],
      ['student', 'Demo Student', '1703999', 'student'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: {
          name,
          roll,
          role,
          email: `bus${index}@example.com`,
          phone: `+8801788888${index}88`,
        },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
  });

  describe('timetable', () => {
    it('needs a login', async () => {
      await http().get('/api/v1/bus/routes').expect(401);
    });

    it('lets admins create a route that members then see, stops in order', async () => {
      const route = await create();
      expect(route.trips.map((t) => [t.direction, t.departsAt])).toEqual([
        ['to_campus', '07:30'],
        ['from_campus', '16:00'],
      ]);
      const list = busRouteListSchema.parse((await as('student').get('/routes').expect(200)).body);
      expect(list.items[0]?.stops.map((s) => s.name)).toEqual([
        'Campus',
        'Talaimari',
        'Railway station',
      ]);
    });

    it('is edited by admins only (moderators too are refused)', async () => {
      await as('student').post('/routes', ROUTE).expect(403);
      await as('moderator').post('/routes', ROUTE).expect(403);
      const route = await create();
      await as('moderator').put(`/routes/${route.id}`, ROUTE).expect(403);
      await as('student').delete(`/routes/${route.id}`).expect(403);
      await as('student').get('/routes?all=true').expect(403);
    });

    it('replaces stops and trips in one save, and refuses duplicate names', async () => {
      const route = await create();
      const updated = busRouteSchema.parse(
        (
          await as('admin')
            .put(`/routes/${route.id}`, {
              ...ROUTE,
              stops: [ROUTE.stops[0], { name: 'Shaheb Bazar', minutesFromCampus: 20 }],
              trips: [
                { direction: 'from_campus', departsAt: '13:15', days: [5], note: 'Friday only' },
              ],
            })
            .expect(200)
        ).body,
      );
      expect(updated.stops.map((s) => s.name)).toEqual(['Campus', 'Shaheb Bazar']);
      expect(updated.trips).toMatchObject([{ departsAt: '13:15', days: [5], note: 'Friday only' }]);
      expect(prisma.busStops).toHaveLength(2);
      await as('admin').post('/routes', ROUTE).expect(409);
    });

    it('validates times, days and stop order', async () => {
      const bad = (patch: object) =>
        as('admin')
          .post('/routes', { ...ROUTE, ...patch })
          .expect(400);
      await bad({ trips: [{ ...ROUTE.trips[0], departsAt: '25:00' }] });
      await bad({ trips: [{ ...ROUTE.trips[0], days: [] }] });
      await bad({ trips: [{ ...ROUTE.trips[0], days: [7] }] });
      await bad({ stops: [{ name: 'Talaimari', minutesFromCampus: 10 }, ROUTE.stops[2]] });
      await bad({ color: 'pink' });
    });

    it('hides inactive routes from members but not from admins', async () => {
      const route = await create({ ...ROUTE, active: false });
      expect(busRouteListSchema.parse((await as('student').get('/routes')).body).items).toEqual([]);
      await as('student').get(`/routes/${route.id}`).expect(404);
      expect(
        busRouteListSchema.parse((await as('admin').get('/routes?all=true')).body).items,
      ).toHaveLength(1);
    });
  });

  describe('notices', () => {
    const day = (offset: number) => dhakaDateKey(new Date(Date.now() + offset * DAY_MS));

    it('shows notices in force today, for a route or all routes', async () => {
      const route = await create();
      await as('admin')
        .post('/notices', {
          routeId: route.id,
          message: 'Diverted via Laxmipur',
          startsOn: day(0),
          endsOn: day(2),
        })
        .expect(201);
      await as('admin')
        .post('/notices', {
          routeId: '',
          message: 'No buses on Friday',
          startsOn: day(3),
          endsOn: day(3),
        })
        .expect(201);
      const current = busNoticeListSchema.parse(
        (await as('student').get('/notices').expect(200)).body,
      );
      expect(current.items).toMatchObject([
        { message: 'Diverted via Laxmipur', route: { name: 'Route A (demo)' } },
      ]);
      const all = busNoticeListSchema.parse((await as('admin').get('/notices?all=true')).body);
      expect(all.items).toHaveLength(2);
    });

    it('lets only admins post and delete notices; dates must be in order', async () => {
      const notice = {
        routeId: null,
        message: 'Exam week timetable',
        startsOn: day(0),
        endsOn: day(1),
      };
      await as('student').post('/notices', notice).expect(403);
      await as('admin')
        .post('/notices', { ...notice, endsOn: day(-1) })
        .expect(400);
      const created = await as('admin').post('/notices', notice).expect(201);
      await as('student').delete(`/notices/${created.body.id}`).expect(403);
      await as('admin').delete(`/notices/${created.body.id}`).expect(204);
    });

    it('deleting a route removes its notices', async () => {
      const route = await create();
      await as('admin')
        .post('/notices', {
          routeId: route.id,
          message: 'Diverted',
          startsOn: day(0),
          endsOn: day(0),
        })
        .expect(201);
      await as('admin').delete(`/routes/${route.id}`).expect(204);
      expect(prisma.busNotices).toHaveLength(0);
    });
  });
});
