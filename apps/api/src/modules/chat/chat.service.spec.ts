import { ChatEvents } from '@ruet-chottor/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePrisma } from '../../../test/fakes/fake-prisma.js';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../core/config/env.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import type { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { ChatRealtime } from './chat-realtime.js';
import { ChatService, directKey } from './chat.service.js';

describe('directKey', () => {
  it('is the same whoever starts the chat', () => {
    expect(directKey('b-id', 'a-id')).toBe(directKey('a-id', 'b-id'));
    expect(directKey('b-id', 'a-id')).toBe('a-id:b-id');
  });
});

describe('ChatService', () => {
  let prisma: FakePrisma;
  let service: ChatService;
  const broadcasts: { userIds: string[]; event: string; messagesSaved: number }[] = [];

  beforeEach(async () => {
    prisma = new FakePrisma();
    broadcasts.length = 0;
    const realtime = {
      // Records how many messages were already saved when each broadcast happened.
      toUsers: (userIds: string[], event: string) =>
        broadcasts.push({ userIds, event, messagesSaved: prisma.messages.length }),
    } as unknown as ChatRealtime;
    const config = { get: () => 30 } as unknown as ConfigService<Env, true>;
    const rateLimit = { consume: async () => {} } as unknown as RateLimitService;
    service = new ChatService(prisma as unknown as PrismaService, rateLimit, realtime, config);
  });

  const person = (name: string, roll: string) =>
    prisma.user.create({
      data: { name, roll, email: `${roll}@example.com`, phone: `+880170000${roll}` },
    });

  it('saves a message before broadcasting it to every member', async () => {
    const [a, b] = await Promise.all([
      person('Sample A', '2103801'),
      person('Sample B', '2103802'),
    ]);
    const chat = await service.startDirect(a.id, b.id);

    const message = await service.send(a.id, chat.id, { body: 'Hello', clientId: 'tmp-1' });

    expect(message).toMatchObject({ body: 'Hello', clientId: 'tmp-1', sender: { id: a.id } });
    const sent = broadcasts.find((entry) => entry.event === ChatEvents.MessageNew);
    expect(sent?.messagesSaved).toBe(1);
    expect(sent?.userIds.sort()).toEqual([a.id, b.id].sort());
  });

  it('marks the sender as having read their own message', async () => {
    const [a, b] = await Promise.all([
      person('Sample A', '2103801'),
      person('Sample B', '2103802'),
    ]);
    const chat = await service.startDirect(a.id, b.id);
    await new Promise((resolve) => setTimeout(resolve, 5)); // unread means "after lastReadAt"
    await service.send(a.id, chat.id, { body: 'Hello' });

    expect((await service.get(a.id, chat.id)).unreadCount).toBe(0);
    expect((await service.get(b.id, chat.id)).unreadCount).toBe(1);
  });

  it('drops members that would push a group over the size limit', async () => {
    const owner = await person('Owner', '2103800');
    const others = await Promise.all(
      Array.from({ length: 49 }, (_, i) =>
        person(`Member ${i}`, `21039${String(i).padStart(2, '0')}`),
      ),
    );
    const group = await service.createGroup(owner.id, {
      name: 'Full house',
      memberIds: others.map((u) => u.id),
    });
    expect(group.members).toHaveLength(50);
    const extra = await person('One more', '2104000');
    await expect(service.addMembers(owner.id, group.id, { userIds: [extra.id] })).rejects.toThrow(
      /at most 50/,
    );
  });
});
