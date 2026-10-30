import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  chatMessagePageSchema,
  chatMessageSchema,
  conversationSchema,
  moderationItemDetailSchema,
  moderationQueuePageSchema,
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

const FLAGS = ['FEATURE_AUTH', 'FEATURE_ADMIN', 'FEATURE_CHAT', 'FEATURE_MODERATION'];
const AUTO_HIDE_AT = 2;
const REASON = 'Scam link sent to a group';
type Person = 'rafiq' | 'nusrat' | 'tanvir' | 'outsider' | 'moderator';

describe('Moderation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrisma;
  let redis: FakeRedis;
  const people = {} as Record<Person, User>;
  const cookies = {} as Record<Person, string>;

  const http = () => request(app.getHttpServer());
  const as = (who: Person) => ({
    get: (path: string) => http().get(`/api/v1${path}`).set('Cookie', cookies[who]),
    post: (path: string, body: object = {}) =>
      http().post(`/api/v1${path}`).set('Cookie', cookies[who]).send(body),
  });

  /** A group of rafiq, nusrat and tanvir with one message from rafiq and one from nusrat. */
  const setup = async () => {
    const group = conversationSchema.parse(
      (
        await as('rafiq')
          .post('/chat/conversations/group', {
            name: 'Study group',
            memberIds: [people.nusrat.id, people.tanvir.id],
          })
          .expect(201)
      ).body,
    );
    const send = async (who: Person, body: string) =>
      chatMessageSchema.parse(
        (await as(who).post(`/chat/conversations/${group.id}/messages`, { body }).expect(201)).body,
      );
    const bad = await send('rafiq', 'Cheap exam answers at example.com');
    const other = await send('nusrat', 'Private reply nobody reported');
    return { group, bad, other };
  };
  const report = (who: Person, contentId: string, reason = 'scam') =>
    as(who).post('/moderation/reports', { contentType: 'chat.message', contentId, reason });

  beforeAll(async () => {
    for (const flag of FLAGS) process.env[flag] = 'true';
    process.env.MODERATION_AUTO_HIDE_REPORTS = String(AUTO_HIDE_AT);
    prisma = new FakePrisma();
    redis = new FakeRedis();
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
    delete process.env.MODERATION_AUTO_HIDE_REPORTS;
  });

  beforeEach(async () => {
    prisma.users = [];
    prisma.conversations = [];
    prisma.conversationMembers = [];
    prisma.messages = [];
    prisma.reports = [];
    prisma.moderationLogs = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string, Role][] = [
      ['rafiq', 'Rafiq Sample', '2103901', 'student'],
      ['nusrat', 'Nusrat Example', '2103902', 'student'],
      ['tanvir', 'Tanvir Demo', '2103903', 'student'],
      ['outsider', 'Outside Person', '2103904', 'student'],
      ['moderator', 'Demo Moderator', '0000002', 'moderator'],
    ];
    for (const [index, [key, name, roll, role]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: {
          name,
          roll,
          role,
          email: `mod${index}@example.com`,
          phone: `+8801722222${index}22`,
        },
      });
      people[key] = user;
      const token = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `session-${key}`, role });
      cookies[key] = `rc_access=${token}`;
    }
  });

  describe('POST /moderation/reports', () => {
    it('needs a login', async () => {
      await http().post('/api/v1/moderation/reports').send({}).expect(401);
    });

    it('records a report once per person', async () => {
      const { bad } = await setup();
      await report('nusrat', bad.id).expect(204);
      const mine = await as('nusrat').get(
        `/moderation/reports/mine?contentType=chat.message&ids=${bad.id}`,
      );
      expect(mine.body).toEqual({ reportedIds: [bad.id] });
      const again = await report('nusrat', bad.id).expect(409);
      expect(again.body.error.code).toBe('CONFLICT');
    });

    it('validates the reason and content type', async () => {
      const { bad } = await setup();
      await report('nusrat', bad.id, 'boring').expect(400);
      await as('nusrat')
        .post('/moderation/reports', {
          contentType: 'news.post',
          contentId: bad.id,
          reason: 'spam',
        })
        .expect(400);
    });

    it('only lets people who can see the item report it, and not their own', async () => {
      const { bad } = await setup();
      await report('outsider', bad.id).expect(404);
      await report('nusrat', crypto.randomUUID()).expect(404);
      await report('rafiq', bad.id).expect(400);
    });

    it('hides an item automatically after enough reports, but tells its sender', async () => {
      const { group, bad } = await setup();
      await report('nusrat', bad.id).expect(204);
      expect(prisma.messages.find((m) => m.id === bad.id)?.status).toBe('visible');
      await report('tanvir', bad.id, 'spam').expect(204);
      expect(prisma.messages.find((m) => m.id === bad.id)?.status).toBe('hidden');
      expect(prisma.moderationLogs[0]).toMatchObject({
        action: 'hide_content',
        details: { auto: true, reports: 2 },
      });

      const forNusrat = chatMessagePageSchema.parse(
        (await as('nusrat').get(`/chat/conversations/${group.id}/messages`)).body,
      );
      expect(forNusrat.items.map((m) => m.id)).not.toContain(bad.id);
      const forRafiq = chatMessagePageSchema.parse(
        (await as('rafiq').get(`/chat/conversations/${group.id}/messages`)).body,
      );
      expect(forRafiq.items.find((m) => m.id === bad.id)).toMatchObject({
        moderated: true,
        body: null,
      });
    });
  });

  describe('staff queue and actions', () => {
    it('is for staff only', async () => {
      await as('nusrat').get('/moderation/queue').expect(403);
      const { bad } = await setup();
      await as('nusrat')
        .post(`/moderation/items/chat.message/${bad.id}/hide`, { reason: REASON })
        .expect(403);
    });

    it('re-checks the role in the database', async () => {
      people.moderator.role = 'student';
      await as('moderator').get('/moderation/queue').expect(403);
    });

    it('lists reported items with counts, and shows only the reported message', async () => {
      const { bad } = await setup();
      await report('nusrat', bad.id).expect(204);
      const queue = moderationQueuePageSchema.parse(
        (await as('moderator').get('/moderation/queue').expect(200)).body,
      );
      expect(queue.items).toHaveLength(1);
      expect(queue.items[0]).toMatchObject({
        contentId: bad.id,
        label: 'Chat message',
        context: 'Group chat',
        preview: 'Cheap exam answers at example.com',
        reportCount: 1,
        author: { name: 'Rafiq Sample' },
      });

      const detail = await as('moderator').get(`/moderation/items/chat.message/${bad.id}`);
      const parsed = moderationItemDetailSchema.parse(detail.body);
      expect(parsed.reports[0]?.reporter?.name).toBe('Nusrat Example');
      expect(JSON.stringify(detail.body)).not.toContain('Private reply nobody reported');
    });

    it('removes an item, closes its reports and logs it', async () => {
      const { bad } = await setup();
      await report('nusrat', bad.id).expect(204);
      const res = await as('moderator')
        .post(`/moderation/items/chat.message/${bad.id}/remove`, { reason: REASON })
        .expect(200);
      const detail = moderationItemDetailSchema.parse(res.body);
      expect(detail.item.contentStatus).toBe('removed');
      expect(detail.reports[0]?.status).toBe('actioned');
      expect(detail.history[0]).toMatchObject({
        action: 'remove_content',
        contentId: bad.id,
        targetUser: { name: 'Rafiq Sample' },
        reason: REASON,
      });
      const open = moderationQueuePageSchema.parse(
        (await as('moderator').get('/moderation/queue')).body,
      );
      expect(open.items).toHaveLength(0);

      await as('moderator')
        .post(`/moderation/items/chat.message/${bad.id}/remove`, { reason: REASON })
        .expect(409);
      await as('moderator')
        .post(`/moderation/items/chat.message/${bad.id}/restore`, { reason: 'Reviewed again' })
        .expect(200);
      expect(prisma.messages.find((m) => m.id === bad.id)?.status).toBe('visible');
    });

    it('dismissing the reports puts an automatically hidden item back', async () => {
      const { bad } = await setup();
      await report('nusrat', bad.id).expect(204);
      await report('tanvir', bad.id).expect(204);
      await as('moderator')
        .post(`/moderation/items/chat.message/${bad.id}/dismiss`, { reason: 'Not a scam link' })
        .expect(200);
      expect(prisma.messages.find((m) => m.id === bad.id)?.status).toBe('visible');
      expect(prisma.reports.every((r) => r.status === 'dismissed')).toBe(true);
    });

    it('needs a reason and a known action', async () => {
      const { bad } = await setup();
      await as('moderator')
        .post(`/moderation/items/chat.message/${bad.id}/hide`, { reason: '' })
        .expect(400);
      await as('moderator')
        .post(`/moderation/items/chat.message/${bad.id}/delete`, { reason: REASON })
        .expect(400);
    });
  });
});
