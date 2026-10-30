import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  clubDetailSchema,
  eventAttendeesSchema,
  eventListSchema,
  eventSchema,
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
  'FEATURE_EVENTS',
  'FEATURE_MODERATION',
];
type Person = 'admin' | 'manager' | 'student' | 'other';
const HOUR = 60 * 60 * 1000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

describe('Events (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new FakePrisma();
  const redis = new FakeRedis();
  const people = {} as Record<Person, User>;
  const cookies = {} as Record<Person, string>;
  let clubId = '';

  const http = () => request(app.getHttpServer());
  const as = (who: Person) => ({
    get: (path: string) => http().get(`/api/v1${path}`).set('Cookie', cookies[who]),
    post: (path: string, body: object = {}) =>
      http().post(`/api/v1${path}`).set('Cookie', cookies[who]).send(body),
    patch: (path: string, body: object) =>
      http().patch(`/api/v1${path}`).set('Cookie', cookies[who]).send(body),
    delete: (path: string) => http().delete(`/api/v1${path}`).set('Cookie', cookies[who]),
  });
  const event = (overrides: object = {}) => ({
    title: 'Line-follower workshop',
    category: 'workshop',
    description: 'Bring a laptop.',
    venue: 'ECE building, room 301',
    startsAt: inHours(48),
    endsAt: inHours(50),
    clubId,
    capacity: null,
    posterId: null,
    ...overrides,
  });
  const create = async (who: Person = 'manager', body: object = {}) =>
    eventSchema.parse((await as(who).post('/events', event(body)).expect(201)).body);
  const range = (who: Person, from = inHours(0), to = inHours(24 * 30)) =>
    as(who).get(`/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

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
    prisma.events = [];
    prisma.eventRsvps = [];
    prisma.moderationLogs = [];
    prisma.reports = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['admin', 'Demo Admin', '0000001', 'admin'],
      ['manager', 'Sadia Sample', '2202904', 'club_manager'],
      ['student', 'Demo Student', '1703999', 'student'],
      ['other', 'Nusrat Example', '2101902', 'student'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: { name, roll, role, email: `ev${index}@example.com`, phone: `+8801755555${index}55` },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
    const club = clubDetailSchema.parse(
      (
        await as('admin')
          .post('/clubs', {
            name: 'Robotics Club (demo)',
            tagline: 'Robots',
            category: 'technical',
            about: '',
            managerIds: [people.manager.id],
          })
          .expect(201)
      ).body,
    );
    clubId = club.id;
  });

  describe('organising', () => {
    it('needs a login', async () => {
      await http().get('/api/v1/events').expect(401);
    });

    it('lets club managers create events for their club, shown on the calendar', async () => {
      const created = await create();
      expect(created).toMatchObject({ club: { id: clubId }, canEdit: true, goingCount: 0 });
      const list = eventListSchema.parse((await range('student').expect(200)).body);
      expect(list.items.map((e) => e.id)).toEqual([created.id]);
      expect(list.items[0]?.canEdit).toBe(false);
    });

    it('refuses members, other clubs and campus-wide events from non-staff', async () => {
      await as('student').post('/events', event()).expect(403);
      await as('manager')
        .post('/events', event({ clubId: null }))
        .expect(403);
      const campusWide = await create('admin', { clubId: null, title: 'Convocation rehearsal' });
      expect(campusWide.club).toBeNull();
    });

    it('validates times and fields', async () => {
      await as('manager')
        .post('/events', event({ endsAt: inHours(47) }))
        .expect(400);
      await as('manager')
        .post('/events', event({ endsAt: inHours(48 + 24 * 20) }))
        .expect(400);
      await as('manager')
        .post('/events', event({ startsAt: inHours(-48), endsAt: inHours(-46) }))
        .expect(400);
      await as('manager')
        .post('/events', event({ category: 'party' }))
        .expect(400);
      await as('student')
        .get(
          `/events?from=${encodeURIComponent(inHours(0))}&to=${encodeURIComponent(inHours(24 * 90))}`,
        )
        .expect(400);
    });

    it('only organisers edit or cancel; a cancelled event stays on the calendar', async () => {
      const created = await create();
      await as('student')
        .patch(`/events/${created.id}`, event({ title: 'Hijacked event' }))
        .expect(403);
      await as('student').post(`/events/${created.id}/cancel`).expect(403);
      const edited = await as('manager')
        .patch(`/events/${created.id}`, event({ venue: 'Central auditorium' }))
        .expect(200);
      expect(edited.body.venue).toBe('Central auditorium');
      await as('admin').post(`/events/${created.id}/cancel`).expect(200);
      const list = eventListSchema.parse((await range('student')).body);
      expect(list.items[0]).toMatchObject({ cancelled: true });
      await as('student').post(`/events/${created.id}/rsvp`).expect(400);
    });
  });

  describe('going', () => {
    it('counts people going and respects the capacity', async () => {
      const created = await create('manager', { capacity: 1 });
      const going = eventSchema.parse(
        (await as('student').post(`/events/${created.id}/rsvp`).expect(200)).body,
      );
      expect(going).toMatchObject({ isGoing: true, goingCount: 1, isFull: true });
      await as('student').post(`/events/${created.id}/rsvp`).expect(200); // a double tap is fine
      const full = await as('other').post(`/events/${created.id}/rsvp`).expect(409);
      expect(full.body.error.message).toMatch(/full/);
      await as('student').delete(`/events/${created.id}/rsvp`).expect(200);
      await as('other').post(`/events/${created.id}/rsvp`).expect(200);
    });

    it('cannot lower the capacity below the people already going', async () => {
      const created = await create('manager', { capacity: 5 });
      await as('student').post(`/events/${created.id}/rsvp`).expect(200);
      await as('other').post(`/events/${created.id}/rsvp`).expect(200);
      await as('manager')
        .patch(`/events/${created.id}`, event({ capacity: 1 }))
        .expect(400);
    });

    it('shows who is going to organisers only', async () => {
      const created = await create();
      await as('student').post(`/events/${created.id}/rsvp`).expect(200);
      await as('other').get(`/events/${created.id}/attendees`).expect(403);
      const list = eventAttendeesSchema.parse(
        (await as('manager').get(`/events/${created.id}/attendees`).expect(200)).body,
      );
      expect(list.items.map((a) => a.name)).toEqual(['Demo Student']);
      expect(JSON.stringify(list)).not.toContain('@example.com');
    });

    it('blocks suspended members', async () => {
      const created = await create();
      people.student.status = 'suspended';
      await as('student').post(`/events/${created.id}/rsvp`).expect(403);
    });
  });

  describe('moderation', () => {
    it('reported events can be hidden from the calendar', async () => {
      const created = await create();
      await as('student')
        .post('/moderation/reports', {
          contentType: 'events.event',
          contentId: created.id,
          reason: 'scam',
        })
        .expect(204);
      await as('admin')
        .post(`/moderation/items/events.event/${created.id}/hide`, { reason: 'Fake ticket sales' })
        .expect(200);
      expect(eventListSchema.parse((await range('student')).body).items).toEqual([]);
      await as('student').get(`/events/${created.id}`).expect(404);
      const own = await as('manager').get(`/events/${created.id}`).expect(200);
      expect(own.body.moderated).toBe(true);
    });
  });
});
