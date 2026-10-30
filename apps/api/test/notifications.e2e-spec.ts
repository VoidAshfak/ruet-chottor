import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  clubDetailSchema,
  eventSchema,
  NotificationEvents,
  type NotificationNewEvent,
  notificationPageSchema,
  newsPostSchema,
  type Role,
  SOCKET_NAMESPACES,
  unreadCountSchema,
} from '@ruet-chottor/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { MailService } from '../src/core/mail/mail.service.js';
import { CloudinaryClient } from '../src/core/media/cloudinary.client.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import type { User } from '../src/generated/prisma/client.js';
import { FakeCloudinary } from './fakes/fake-cloudinary.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const FLAGS = [
  'FEATURE_AUTH',
  'FEATURE_ADMIN',
  'FEATURE_CLUBS',
  'FEATURE_NEWS',
  'FEATURE_EVENTS',
  'FEATURE_MODERATION',
  'FEATURE_NOTIFICATIONS',
];
const WEB_ORIGIN = 'http://localhost:3000';
type Person = 'admin' | 'moderator' | 'manager' | 'student' | 'other';
const HOUR = 60 * 60 * 1000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl = '';
  const prisma = new FakePrisma();
  const redis = new FakeRedis();
  const people = {} as Record<Person, User>;
  const tokens = {} as Record<Person, string>;
  const sockets: Socket[] = [];

  const http = () => request(app.getHttpServer());
  const as = (who: Person) => {
    const cookie = `rc_access=${tokens[who]}`;
    return {
      get: (path: string) => http().get(`/api/v1${path}`).set('Cookie', cookie),
      post: (path: string, body: object = {}) =>
        http().post(`/api/v1${path}`).set('Cookie', cookie).send(body),
      patch: (path: string, body: object) =>
        http().patch(`/api/v1${path}`).set('Cookie', cookie).send(body),
    };
  };
  const inbox = async (who: Person) =>
    notificationPageSchema.parse((await as(who).get('/notifications').expect(200)).body).items;
  const unread = async (who: Person) =>
    unreadCountSchema.parse((await as(who).get('/notifications/unread-count').expect(200)).body)
      .count;
  const sendTo = (who: Person, title = 'Hello') =>
    app.get(NotificationsService).notify([people[who].id], { type: 'news.approved', title });

  const createClub = async () =>
    clubDetailSchema.parse(
      (
        await as('admin')
          .post('/clubs', {
            name: 'Robotics Club (demo)',
            tagline: 'Build robots.',
            category: 'technical',
            about: 'Weekly workshops.',
            managerIds: [people.manager.id],
          })
          .expect(201)
      ).body,
    );
  const studentPost = async () =>
    newsPostSchema.parse(
      (
        await as('student')
          .post('/news', {
            title: 'Robotics club meets on Thursday',
            category: 'club',
            body: 'Bring your laptops. We will plan the line-follower contest for next month.',
          })
          .expect(201)
      ).body,
    );
  const startsAt = inHours(48);
  const endsAt = inHours(50);
  const event = (overrides: object = {}) => ({
    title: 'Line-follower workshop',
    category: 'workshop',
    description: 'Bring a laptop.',
    venue: 'ECE building, room 301',
    startsAt,
    endsAt,
    clubId: null,
    capacity: null,
    posterId: null,
    ...overrides,
  });

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
    await app.listen(0, '127.0.0.1');
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
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
    prisma.events = [];
    prisma.eventRsvps = [];
    prisma.mediaAssets = [];
    prisma.reports = [];
    prisma.notifications = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['admin', 'Demo Admin', '0000001', 'admin'],
      ['moderator', 'Demo Moderator', '0000002', 'moderator'],
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
          email: `notify${index}@example.com`,
          phone: `+8801755555${index}55`,
        },
      });
      people[key] = user;
      tokens[key] = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `s-${key}`, role });
    }
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  describe('inbox', () => {
    it('needs a login', async () => {
      await http().get('/api/v1/notifications').expect(401);
      await http().get('/api/v1/notifications/unread-count').expect(401);
      await http().post('/api/v1/notifications/read-all').expect(401);
    });

    it('lists only your own notifications, newest first, and pages them', async () => {
      await sendTo('student', 'First');
      await sendTo('student', 'Second');
      await sendTo('other', 'Not yours');
      expect((await inbox('student')).map((n) => n.title)).toEqual(['Second', 'First']);

      const page = notificationPageSchema.parse(
        (await as('student').get('/notifications?limit=1').expect(200)).body,
      );
      expect(page.items).toHaveLength(1);
      const next = notificationPageSchema.parse(
        (await as('student').get(`/notifications?limit=1&cursor=${page.nextCursor}`)).body,
      );
      expect(next.items.map((n) => n.title)).toEqual(['First']);
      await as('student').get('/notifications?limit=500').expect(400);
    });

    it('marks one or all as read', async () => {
      await sendTo('student', 'First');
      await sendTo('student', 'Second');
      expect(await unread('student')).toBe(2);

      const [latest] = await inbox('student');
      const read = await as('student').post(`/notifications/${latest!.id}/read`).expect(200);
      expect(read.body).toMatchObject({ id: latest!.id, read: true });
      expect(await unread('student')).toBe(1);

      await as('student').post('/notifications/read-all').expect(204);
      expect(await unread('student')).toBe(0);
    });

    it('refuses bad ids and other members’ notifications', async () => {
      await sendTo('student');
      const [mine] = await inbox('student');
      await as('student').post('/notifications/not-a-uuid/read').expect(400);
      await as('other').post(`/notifications/${mine!.id}/read`).expect(404);
      expect(await unread('student')).toBe(1);
    });

    it('drops notifications older than 90 days when new ones arrive', async () => {
      await sendTo('student', 'Old');
      prisma.notifications[0]!.createdAt = new Date(Date.now() - 91 * 24 * HOUR);
      await sendTo('student', 'New');
      expect((await inbox('student')).map((n) => n.title)).toEqual(['New']);
    });
  });

  describe('socket /notifications', () => {
    const connect = (headers: Record<string, string>) => {
      const socket = io(`${baseUrl}${SOCKET_NAMESPACES.notifications}`, {
        transports: ['websocket'],
        extraHeaders: headers,
        reconnection: false,
      });
      sockets.push(socket);
      return socket;
    };

    it('rejects connections without a session', async () => {
      const socket = connect({ origin: WEB_ORIGIN });
      const error = await new Promise<Error & { data?: { code: string } }>((resolve) =>
        socket.once('connect_error', resolve),
      );
      expect(error.data?.code).toBe('SESSION_EXPIRED');
    });

    it('pushes a new notification to its owner only', async () => {
      const student = connect({ cookie: `rc_access=${tokens.student}`, origin: WEB_ORIGIN });
      const other = connect({ cookie: `rc_access=${tokens.other}`, origin: WEB_ORIGIN });
      await Promise.all(
        [student, other].map(
          (s) => new Promise<void>((resolve) => s.once('connect', () => resolve())),
        ),
      );
      let otherGotOne = false;
      other.on(NotificationEvents.New, () => (otherGotOne = true));
      const received = new Promise<NotificationNewEvent>((resolve) =>
        student.once(NotificationEvents.New, resolve),
      );

      await sendTo('student', 'Live');
      expect((await received).notification).toMatchObject({ title: 'Live', read: false });
      expect(otherGotOne).toBe(false);
    });
  });

  describe('sent by other modules', () => {
    it('clubs: appointed managers, join requests and approvals', async () => {
      const club = await createClub();
      expect(await inbox('manager')).toMatchObject([
        { type: 'clubs.manager_appointed', link: `/clubs/${club.slug}` },
      ]);

      await as('student').post(`/clubs/${club.id}/membership`).expect(201);
      expect((await inbox('manager'))[0]).toMatchObject({
        type: 'clubs.join_requested',
        title: `Demo Student asked to join ${club.name}`,
        link: `/clubs/${club.slug}/members`,
      });

      await as('manager')
        .post(`/clubs/${club.id}/members/${people.student.id}/approve`)
        .expect(204);
      expect(await inbox('student')).toMatchObject([{ type: 'clubs.join_approved' }]);
    });

    it('news: the author hears about approval and rejection, with the reason', async () => {
      const rejected = await studentPost();
      await as('moderator')
        .post(`/news/${rejected.id}/reject`, { reason: 'Please add the venue and time.' })
        .expect(200);
      expect((await inbox('student'))[0]).toMatchObject({
        type: 'news.rejected',
        body: "Moderator's reason: Please add the venue and time.",
        link: `/news/${rejected.id}`,
      });

      const approved = await studentPost();
      await as('moderator').post(`/news/${approved.id}/approve`, {}).expect(200);
      expect((await inbox('student'))[0]).toMatchObject({ type: 'news.approved' });
    });

    it('events: people going hear about a new time or venue and a cancellation', async () => {
      const created = eventSchema.parse(
        (await as('admin').post('/events', event()).expect(201)).body,
      );
      await as('student').post(`/events/${created.id}/rsvp`).expect(200);
      await as('admin').post(`/events/${created.id}/rsvp`).expect(200);

      // A new description is not worth a notification.
      await as('admin')
        .patch(`/events/${created.id}`, event({ description: 'Bring two laptops.' }))
        .expect(200);
      expect(await inbox('student')).toEqual([]);

      await as('admin')
        .patch(`/events/${created.id}`, event({ venue: 'Central auditorium' }))
        .expect(200);
      expect((await inbox('student'))[0]).toMatchObject({
        type: 'events.changed',
        link: `/events/${created.id}`,
      });
      expect((await inbox('student'))[0]?.body).toContain('Central auditorium');

      await as('admin').post(`/events/${created.id}/cancel`).expect(200);
      expect((await inbox('student'))[0]).toMatchObject({ type: 'events.cancelled' });
      // The organiser made the changes, so they are not told about them.
      expect(await inbox('admin')).toEqual([]);
      expect(await inbox('other')).toEqual([]);
    });

    it('moderation: the author hears when content is hidden, restored or removed', async () => {
      const post = await studentPost();
      await as('moderator').post(`/news/${post.id}/approve`, {}).expect(200);
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
      expect((await inbox('student'))[0]).toMatchObject({
        type: 'moderation.hidden',
        title: 'Your news post was hidden',
        body: 'Reason: Wrong exam dates',
        link: `/news/${post.id}`,
      });

      await as('moderator')
        .post(`/moderation/items/news.post/${post.id}/restore`, {
          reason: 'Dates checked with the office',
        })
        .expect(200);
      expect((await inbox('student'))[0]).toMatchObject({ type: 'moderation.restored' });

      await as('moderator')
        .post(`/moderation/items/news.post/${post.id}/remove`, { reason: 'Advertising, not news' })
        .expect(200);
      // Removed content is gone for the author too, so there is nothing to link to.
      expect((await inbox('student'))[0]).toMatchObject({ type: 'moderation.removed', link: null });
      // Reporters stay anonymous: nothing in the inbox names them.
      expect(JSON.stringify(await inbox('student'))).not.toContain('Nusrat');
    });
  });
});
