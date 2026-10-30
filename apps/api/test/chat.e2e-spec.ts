import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ChatEvents,
  chatMessagePageSchema,
  chatMessageSchema,
  type ChatSendAck,
  conversationPageSchema,
  conversationSchema,
  SOCKET_NAMESPACES,
} from '@ruet-chottor/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AccessTokenStore } from '../src/core/auth/access-token.store.js';
import { PrismaService } from '../src/core/prisma/prisma.service.js';
import { RedisService } from '../src/core/redis/redis.service.js';
import type { User } from '../src/generated/prisma/client.js';
import { FakePrisma } from './fakes/fake-prisma.js';
import { FakeRedis } from './fakes/fake-redis.js';

const FLAGS = ['FEATURE_AUTH', 'FEATURE_CHAT'];
const WEB_ORIGIN = 'http://localhost:3000';
const SEND_LIMIT = 5;
type Person = 'rafiq' | 'nusrat' | 'tanvir' | 'outsider';

describe('Chat (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: FakePrisma;
  let redis: FakeRedis;
  let baseUrl: string;
  const people = {} as Record<Person, User>;
  const tokens = {} as Record<Person, string>;
  const sockets: Socket[] = [];

  const http = () => request(app.getHttpServer());
  const as = (who: Person) => {
    const cookie = `rc_access=${tokens[who]}`;
    return {
      get: (path: string) => http().get(`/api/v1/chat${path}`).set('Cookie', cookie),
      post: (path: string, body: object = {}) =>
        http().post(`/api/v1/chat${path}`).set('Cookie', cookie).send(body),
      patch: (path: string, body: object) =>
        http().patch(`/api/v1/chat${path}`).set('Cookie', cookie).send(body),
      delete: (path: string) => http().delete(`/api/v1/chat${path}`).set('Cookie', cookie),
    };
  };

  const connect = (headers: Record<string, string>) => {
    const socket = io(`${baseUrl}${SOCKET_NAMESPACES.chat}`, {
      transports: ['websocket'],
      extraHeaders: headers,
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };
  const connectAs = async (who: Person) => {
    const socket = connect({ cookie: `rc_access=${tokens[who]}`, origin: WEB_ORIGIN });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const nextEvent = <T>(socket: Socket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, resolve));

  const startDirect = async (from: Person, to: Person) =>
    conversationSchema.parse(
      (await as(from).post('/conversations/direct', { userId: people[to].id }).expect(201)).body,
    );
  const createGroup = async (owner: Person, members: Person[]) =>
    conversationSchema.parse(
      (
        await as(owner)
          .post('/conversations/group', {
            name: 'CSE 21 project',
            memberIds: members.map((m) => people[m].id),
          })
          .expect(201)
      ).body,
    );
  const send = (who: Person, conversationId: string, body: string) =>
    as(who).post(`/conversations/${conversationId}/messages`, { body });

  beforeAll(async () => {
    for (const flag of FLAGS) process.env[flag] = 'true';
    process.env.CHAT_SEND_LIMIT_PER_MINUTE = String(SEND_LIMIT);
    prisma = new FakePrisma();
    redis = new FakeRedis();
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ client: redis, health: async () => 'up' })
      .compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.listen(0, '127.0.0.1');
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    for (const flag of FLAGS) delete process.env[flag];
    delete process.env.CHAT_SEND_LIMIT_PER_MINUTE;
  });

  beforeEach(async () => {
    prisma.users = [];
    prisma.conversations = [];
    prisma.conversationMembers = [];
    prisma.messages = [];
    for (const key of redis.keys()) void redis.del(key);
    const accounts: [Person, string, string][] = [
      ['rafiq', 'Rafiq Sample', '2103901'],
      ['nusrat', 'Nusrat Example', '2103902'],
      ['tanvir', 'Tanvir Demo', '2103903'],
      ['outsider', 'Outside Person', '2103904'],
    ];
    for (const [index, [key, name, roll]] of accounts.entries()) {
      const user = await prisma.user.create({
        data: { name, roll, email: `chat${index}@example.com`, phone: `+8801711111${index}11` },
      });
      people[key] = user;
      tokens[key] = await app
        .get(AccessTokenStore)
        .issue({ userId: user.id, sessionId: `session-${key}`, role: 'student' });
    }
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  describe('access', () => {
    it('needs a login', async () => {
      const res = await http().get('/api/v1/chat/conversations').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('hides conversations from non-members with 404', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      await as('outsider').get(`/conversations/${chat.id}`).expect(404);
      await as('outsider').get(`/conversations/${chat.id}/messages`).expect(404);
      await send('outsider', chat.id, 'Hello?').expect(404);
    });

    it('validates ids and bodies', async () => {
      await as('rafiq').get('/conversations/not-a-uuid').expect(400);
      const res = await as('rafiq').post('/conversations/direct', { userId: 'x' }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('1:1 chats', () => {
    it('creates one chat per pair, whoever starts it', async () => {
      const first = await startDirect('rafiq', 'nusrat');
      const again = await startDirect('nusrat', 'rafiq');
      expect(again.id).toBe(first.id);
      expect(first.type).toBe('direct');
      expect(first.members.map((m) => m.name).sort()).toEqual(['Nusrat Example', 'Rafiq Sample']);
      expect(prisma.conversations).toHaveLength(1);
    });

    it('refuses a chat with yourself or with a suspended member', async () => {
      await as('rafiq').post('/conversations/direct', { userId: people.rafiq.id }).expect(400);
      people.nusrat.status = 'suspended';
      await as('rafiq').post('/conversations/direct', { userId: people.nusrat.id }).expect(404);
    });

    it('does not leak contact details', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      await send('rafiq', chat.id, 'Hi!').expect(201);
      const res = await as('nusrat').get('/conversations').expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/@example\.com|\+880/);
    });
  });

  describe('groups', () => {
    it('lets the owner rename and add members, but not other members', async () => {
      const group = await createGroup('rafiq', ['nusrat']);
      expect(group.myRole).toBe('owner');
      await as('nusrat').patch(`/conversations/${group.id}`, { name: 'Renamed' }).expect(403);
      await as('nusrat')
        .post(`/conversations/${group.id}/members`, { userIds: [people.tanvir.id] })
        .expect(403);

      const renamed = await as('rafiq')
        .patch(`/conversations/${group.id}`, { name: 'Thesis group' })
        .expect(200);
      expect(renamed.body.name).toBe('Thesis group');
      const added = await as('rafiq')
        .post(`/conversations/${group.id}/members`, { userIds: [people.tanvir.id] })
        .expect(201);
      expect(conversationSchema.parse(added.body).members).toHaveLength(3);
    });

    it('rejects an empty name and too many members', async () => {
      await as('rafiq')
        .post('/conversations/group', { name: ' ', memberIds: [people.nusrat.id] })
        .expect(400);
      const tooMany = Array.from({ length: 50 }, () => crypto.randomUUID());
      await as('rafiq')
        .post('/conversations/group', { name: 'Big', memberIds: tooMany })
        .expect(400);
    });

    it('hands the group to the longest-standing member when the owner leaves', async () => {
      const group = await createGroup('rafiq', ['nusrat', 'tanvir']);
      await as('rafiq').delete(`/conversations/${group.id}/members/${people.rafiq.id}`).expect(204);
      await as('rafiq').get(`/conversations/${group.id}`).expect(404);
      const after = conversationSchema.parse(
        (await as('nusrat').get(`/conversations/${group.id}`).expect(200)).body,
      );
      expect(after.members.find((m) => m.conversationRole === 'owner')).toBeDefined();
      expect(after.members).toHaveLength(2);
    });

    it('shows new members only messages sent after they joined', async () => {
      const group = await createGroup('rafiq', ['nusrat']);
      await send('rafiq', group.id, 'Before Tanvir joined').expect(201);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await as('rafiq')
        .post(`/conversations/${group.id}/members`, { userIds: [people.tanvir.id] })
        .expect(201);
      await send('rafiq', group.id, 'Welcome Tanvir').expect(201);
      const page = chatMessagePageSchema.parse(
        (await as('tanvir').get(`/conversations/${group.id}/messages`).expect(200)).body,
      );
      expect(page.items.map((m) => m.body)).toEqual(['Welcome Tanvir']);
    });

    it('stops a suspended owner from changing the group, but lets them leave', async () => {
      const group = await createGroup('rafiq', ['nusrat']);
      people.rafiq.status = 'suspended';
      await as('rafiq').patch(`/conversations/${group.id}`, { name: 'Spam deals' }).expect(403);
      await as('rafiq')
        .post(`/conversations/${group.id}/members`, { userIds: [people.tanvir.id] })
        .expect(403);
      await as('rafiq')
        .delete(`/conversations/${group.id}/members/${people.nusrat.id}`)
        .expect(403);
      await as('rafiq').delete(`/conversations/${group.id}/members/${people.rafiq.id}`).expect(204);
    });

    it('cannot remove people from a 1:1 chat', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      await as('rafiq').delete(`/conversations/${chat.id}/members/${people.nusrat.id}`).expect(400);
    });
  });

  describe('messages', () => {
    it('pages newest first and catches up with ?after=', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      const sent = [];
      for (const body of ['one', 'two', 'three']) {
        sent.push(chatMessageSchema.parse((await send('rafiq', chat.id, body).expect(201)).body));
      }
      const page = chatMessagePageSchema.parse(
        (await as('nusrat').get(`/conversations/${chat.id}/messages?limit=2`).expect(200)).body,
      );
      expect(page.items.map((m) => m.body)).toEqual(['three', 'two']);
      const older = chatMessagePageSchema.parse(
        (
          await as('nusrat')
            .get(`/conversations/${chat.id}/messages?limit=2&cursor=${page.nextCursor}`)
            .expect(200)
        ).body,
      );
      expect(older.items.map((m) => m.body)).toEqual(['one']);
      const missed = chatMessagePageSchema.parse(
        (await as('nusrat').get(`/conversations/${chat.id}/messages?after=${sent[0]!.id}`)).body,
      );
      expect(missed.items.map((m) => m.body)).toEqual(['two', 'three']);
    });

    it('counts unread messages until the chat is read', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      await send('rafiq', chat.id, 'Are you coming?').expect(201);
      await send('rafiq', chat.id, 'Class starts at 9').expect(201);
      const list = conversationPageSchema.parse(
        (await as('nusrat').get('/conversations').expect(200)).body,
      );
      expect(list.items[0]?.unreadCount).toBe(2);
      expect(list.items[0]?.lastMessage?.body).toBe('Class starts at 9');
      await as('nusrat').post(`/conversations/${chat.id}/read`).expect(204);
      const read = conversationPageSchema.parse((await as('nusrat').get('/conversations')).body);
      expect(read.items[0]?.unreadCount).toBe(0);
    });

    it('gives each chat in the list its own last message and unread count', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      const group = await createGroup('tanvir', ['nusrat']);
      await send('rafiq', chat.id, 'One').expect(201);
      await send('tanvir', group.id, 'Meeting at 5').expect(201);
      await send('tanvir', group.id, 'Spam').expect(201);
      await send('tanvir', group.id, 'More spam').expect(201);
      // The latest message is hidden by a moderator, so the one before it is shown instead.
      prisma.messages.find((m) => m.body === 'Spam')!.status = 'hidden';
      prisma.messages.find((m) => m.body === 'More spam')!.status = 'hidden';

      const list = conversationPageSchema.parse(
        (await as('nusrat').get('/conversations').expect(200)).body,
      );
      const byId = new Map(list.items.map((c) => [c.id, c]));
      expect(byId.get(chat.id)).toMatchObject({ unreadCount: 1, lastMessage: { body: 'One' } });
      expect(byId.get(group.id)).toMatchObject({
        unreadCount: 1,
        lastMessage: { body: 'Meeting at 5' },
      });
    });

    it('rejects empty and over-long messages', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      await send('rafiq', chat.id, '   ').expect(400);
      await send('rafiq', chat.id, 'x'.repeat(2001)).expect(400);
    });

    it('blocks suspended members from sending', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      people.rafiq.status = 'suspended';
      const res = await send('rafiq', chat.id, 'Still here').expect(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('rate-limits sending', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      for (let i = 0; i < SEND_LIMIT; i += 1) await send('rafiq', chat.id, `spam ${i}`).expect(201);
      const res = await send('rafiq', chat.id, 'one too many').expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });

    it('lets senders delete only their own messages', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      const message = chatMessageSchema.parse((await send('rafiq', chat.id, 'Oops')).body);
      await as('nusrat').delete(`/messages/${message.id}`).expect(403);
      await as('rafiq').delete(`/messages/${message.id}`).expect(204);
      const page = chatMessagePageSchema.parse(
        (await as('nusrat').get(`/conversations/${chat.id}/messages`)).body,
      );
      expect(page.items[0]).toMatchObject({ deleted: true, body: null });
      expect(prisma.messages[0]?.body).toBe('Oops'); // kept for moderators
    });

    it('does not serve messages hidden by moderators', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      await send('rafiq', chat.id, 'Scam link').expect(201);
      prisma.messages[0]!.status = 'hidden';
      const page = chatMessagePageSchema.parse(
        (await as('nusrat').get(`/conversations/${chat.id}/messages`)).body,
      );
      expect(page.items).toEqual([]);
    });
  });

  describe('socket /chat', () => {
    it('rejects connections without a session or from another origin', async () => {
      const anonymous = connect({ origin: WEB_ORIGIN });
      const error = await nextEvent<Error & { data?: { code: string } }>(
        anonymous,
        'connect_error',
      );
      expect(error.data?.code).toBe('SESSION_EXPIRED');

      const foreign = connect({ cookie: `rc_access=${tokens.rafiq}`, origin: 'https://evil.test' });
      await nextEvent(foreign, 'connect_error');
      expect(foreign.connected).toBe(false);
    });

    it('saves a message, acknowledges it and delivers it to the other member', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      const [rafiq, nusrat] = await Promise.all([connectAs('rafiq'), connectAs('nusrat')]);
      const received = nextEvent<{ message: { body: string } }>(nusrat, ChatEvents.MessageNew);

      const ack: ChatSendAck = await rafiq.emitWithAck(ChatEvents.MessageSend, {
        conversationId: chat.id,
        body: 'Lab at 2 PM?',
        clientId: 'pending-1',
      });
      expect(ack).toMatchObject({
        ok: true,
        message: { body: 'Lab at 2 PM?', clientId: 'pending-1' },
      });
      expect(prisma.messages).toHaveLength(1);
      expect((await received).message.body).toBe('Lab at 2 PM?');
    });

    it('answers invalid payloads and non-members with an error ack', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      const outsider = await connectAs('outsider');
      const invalid: ChatSendAck = await outsider.emitWithAck(ChatEvents.MessageSend, {
        conversationId: chat.id,
        body: '',
      });
      expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
      const denied: ChatSendAck = await outsider.emitWithAck(ChatEvents.MessageSend, {
        conversationId: chat.id,
        body: 'Let me in',
      });
      expect(denied).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
      expect(prisma.messages).toHaveLength(0);
    });

    it('shows typing to the other members only', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      const [rafiq, nusrat] = await Promise.all([connectAs('rafiq'), connectAs('nusrat')]);
      const typing = nextEvent<{ name: string }>(nusrat, ChatEvents.TypingUpdate);
      let echoed = false;
      rafiq.on(ChatEvents.TypingUpdate, () => (echoed = true));
      rafiq.emit(ChatEvents.TypingStart, { conversationId: chat.id });
      expect((await typing).name).toBe('Rafiq Sample');
      expect(echoed).toBe(false);
    });

    it('stops a socket whose session was ended', async () => {
      const chat = await startDirect('rafiq', 'nusrat');
      const rafiq = await connectAs('rafiq');
      await app.get(AccessTokenStore).revoke(tokens.rafiq);
      const ack: ChatSendAck = await rafiq.emitWithAck(ChatEvents.MessageSend, {
        conversationId: chat.id,
        body: 'After logout',
      });
      expect(ack).toMatchObject({ ok: false, error: { code: 'SESSION_EXPIRED' } });
      expect(prisma.messages).toHaveLength(0);
    });
  });
});
