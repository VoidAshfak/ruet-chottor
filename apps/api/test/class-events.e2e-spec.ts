import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  eventListSchema,
  eventReviewPageSchema,
  eventSchema,
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

const FLAGS = [
  'FEATURE_AUTH',
  'FEATURE_USERS',
  'FEATURE_ADMIN',
  'FEATURE_EVENTS',
  'FEATURE_NOTIFICATIONS',
];
type Person = 'cr' | 'student' | 'moderator' | 'crModerator';

const DAY = 24 * 60 * 60 * 1000;
const start = new Date(Date.now() + 3 * DAY);
const EVENT = {
  title: 'CSE 21 farewell planning',
  category: 'meeting',
  description: 'Venue, food and the slideshow.',
  venue: 'ECE building, room 301',
  startsAt: start.toISOString(),
  endsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
  clubId: null,
  capacity: null,
  posterId: null,
  forClass: true,
};
const REASON = 'Please add the time the room is booked until.';

describe('Class events by class representatives (e2e)', () => {
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
  });
  const create = async (who: Person = 'cr', body: object = EVENT) =>
    eventSchema.parse((await as(who).post('/events', body).expect(201)).body);
  const calendar = async (who: Person = 'student') => {
    const from = new Date(Date.now() - DAY).toISOString();
    const to = new Date(Date.now() + 30 * DAY).toISOString();
    const res = await as(who)
      .get(`/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .expect(200);
    return eventListSchema.parse(res.body).items.map((e) => e.id);
  };
  const queue = async () =>
    eventReviewPageSchema
      .parse((await as('moderator').get('/events/review').expect(200)).body)
      .items.map((e) => e.id);
  const makeRep = (who: Person, section: 'A' | 'B' | null = 'A') =>
    prisma.classRepRequest.create({
      data: {
        userId: people[who].id,
        section,
        note: 'Verified in the test setup.',
        status: 'approved',
      },
    });

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
    prisma.events = [];
    prisma.eventRsvps = [];
    prisma.classRepRequests = [];
    prisma.moderationLogs = [];
    prisma.notifications = [];
    prisma.mediaAssets = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['cr', 'Demo CR', '2103045', 'student'],
      ['student', 'Nusrat Example', '2101902', 'student'],
      ['moderator', 'Demo Moderator', '0000002', 'moderator'],
      ['crModerator', 'Moderating CR', '2003050', 'moderator'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: { name, roll, role, email: `ce${index}@example.com`, phone: `+8801755555${index}55` },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
    await makeRep('cr');
  });

  describe('access and validation', () => {
    it('needs a login, and keeps the review queue for staff', async () => {
      await http().get('/api/v1/events/review').expect(401);
      await as('cr').get('/events/review').expect(403);
      const event = await create();
      await as('student').post(`/events/${event.id}/approve`).expect(403);
    });

    it('validates the request', async () => {
      await as('cr')
        .post('/events', { ...EVENT, clubId: '0192d4a0-0000-7000-8000-000000000099' })
        .expect(400);
      await as('cr')
        .post('/events', { ...EVENT, forClass: 'yes' })
        .expect(400);
    });

    it('is only for verified class representatives', async () => {
      const res = await as('student').post('/events', EVENT).expect(403);
      expect(res.body.error.message).toMatch(/class representatives/);
    });
  });

  describe('review', () => {
    it('waits off the calendar, visible only to its organiser and staff', async () => {
      const event = await create();
      expect(event).toMatchObject({
        review: 'pending',
        club: null,
        class: { department: { short: 'CSE' }, series: 2021, section: 'A' },
        canEdit: true,
        canEditDetails: true,
      });
      expect(await calendar()).toEqual([]);
      await as('student').get(`/events/${event.id}`).expect(404);
      await as('student').post(`/events/${event.id}/rsvp`).expect(404);
      await as('cr').get(`/events/${event.id}`).expect(200);
      expect(await queue()).toEqual([event.id]);
    });

    it('approval puts it on the calendar, logs it and tells the CR', async () => {
      const event = await create();
      const approved = eventSchema.parse(
        (await as('moderator').post(`/events/${event.id}/approve`).expect(200)).body,
      );
      expect(approved.review).toBe('approved');
      expect(await calendar()).toEqual([event.id]);
      expect(await queue()).toEqual([]);
      expect(prisma.moderationLogs[0]).toMatchObject({
        action: 'approve_content',
        contentType: 'events.event',
        contentId: event.id,
        targetUserId: people.cr.id,
      });
      expect(prisma.notifications[0]).toMatchObject({
        userId: people.cr.id,
        type: 'events.approved',
        body: 'Class event for CSE 2021, section A.',
      });
      await as('student').post(`/events/${event.id}/rsvp`).expect(200);
      await as('moderator').post(`/events/${event.id}/approve`).expect(404);
    });

    it('rejection needs a reason, which only the organiser and staff see', async () => {
      const event = await create();
      await as('moderator').post(`/events/${event.id}/reject`, {}).expect(400);
      await as('moderator').post(`/events/${event.id}/reject`, { reason: REASON }).expect(200);
      const mine = eventSchema.parse((await as('cr').get(`/events/${event.id}`)).body);
      expect(mine).toMatchObject({ review: 'rejected', reviewNote: REASON });
      expect(prisma.notifications[0]?.type).toBe('events.rejected');
      expect(await calendar()).toEqual([]);
    });

    it('staff cannot approve their own class event', async () => {
      await makeRep('crModerator', null);
      const event = await create('crModerator');
      await as('crModerator').post(`/events/${event.id}/approve`).expect(403);
      await as('moderator').post(`/events/${event.id}/approve`).expect(200);
    });
  });

  describe('changes', () => {
    it("a CR's edit goes back to review; approving it again tells the people going", async () => {
      const event = await create();
      await as('moderator').post(`/events/${event.id}/approve`).expect(200);
      await as('student').post(`/events/${event.id}/rsvp`).expect(200);

      const edited = eventSchema.parse(
        (
          await as('cr')
            .patch(`/events/${event.id}`, { ...EVENT, venue: 'Central field' })
            .expect(200)
        ).body,
      );
      expect(edited.review).toBe('pending');
      expect(await calendar()).toEqual([]);
      // Nobody going is told yet: they could not open it while it waits.
      expect(prisma.notifications.filter((n) => n.userId === people.student.id)).toEqual([]);

      await as('moderator').post(`/events/${event.id}/approve`).expect(200);
      expect(await calendar()).toEqual([event.id]);
      expect(prisma.notifications.at(-1)).toMatchObject({
        userId: people.student.id,
        type: 'events.changed',
      });
    });

    it('an event cannot switch between a class event and other events', async () => {
      const event = await create();
      await as('cr')
        .patch(`/events/${event.id}`, { ...EVENT, forClass: false })
        .expect(400);
    });

    it('a former CR keeps their events and can cancel them, but not create or edit', async () => {
      const event = await create();
      await as('moderator').post(`/events/${event.id}/approve`).expect(200);
      prisma.classRepRequests[0]!.status = 'revoked';

      await as('cr').post('/events', EVENT).expect(403);
      await as('cr').patch(`/events/${event.id}`, EVENT).expect(403);
      const seen = eventSchema.parse((await as('cr').get(`/events/${event.id}`)).body);
      expect(seen).toMatchObject({ canEdit: true, canEditDetails: false });
      expect(await calendar()).toEqual([event.id]);
      await as('cr').post(`/events/${event.id}/cancel`).expect(200);
    });
  });
});
