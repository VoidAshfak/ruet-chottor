import { NOTIFICATION_LIMITS, NotificationEvents } from '@ruet-chottor/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePrisma } from '../../../test/fakes/fake-prisma.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { NotificationsRealtime } from './notifications-realtime.js';
import { NotificationsService } from './notifications.service.js';

const ALICE = '0192d4a0-0000-7000-8000-00000000000a';
const BOB = '0192d4a0-0000-7000-8000-00000000000b';

/** Records what would go out over the socket. */
class RecordingRealtime extends NotificationsRealtime {
  sent: { userId: string; event: string }[] = [];
  override toUser(userId: string, event: string) {
    this.sent.push({ userId, event });
  }
}

describe('NotificationsService', () => {
  let prisma: FakePrisma;
  let realtime: RecordingRealtime;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = new FakePrisma();
    realtime = new RecordingRealtime();
    service = new NotificationsService(prisma as unknown as PrismaService, realtime);
  });

  it('sends one notification per person, even if they are listed twice', async () => {
    await service.notify([ALICE, BOB, ALICE], { type: 'events.cancelled', title: 'Cancelled' });
    expect(prisma.notifications.map((n) => n.userId).sort()).toEqual([ALICE, BOB].sort());
    expect(realtime.sent).toEqual([
      { userId: ALICE, event: NotificationEvents.New },
      { userId: BOB, event: NotificationEvents.New },
    ]);
  });

  it('does nothing for nobody', async () => {
    await service.notify([], { type: 'events.cancelled', title: 'Cancelled' });
    expect(prisma.notifications).toEqual([]);
  });

  it('shortens text that is too long', async () => {
    await service.notify([ALICE], {
      type: 'news.rejected',
      title: 'x'.repeat(500),
      body: 'y'.repeat(500),
    });
    const [row] = prisma.notifications;
    expect(row!.title).toHaveLength(NOTIFICATION_LIMITS.titleMax);
    expect(row!.body).toHaveLength(NOTIFICATION_LIMITS.bodyMax);
    expect(row!.title.endsWith('…')).toBe(true);
  });

  it('never throws, so the action that caused it still succeeds', async () => {
    prisma.notification.createManyAndReturn = async () => {
      throw new Error('database down');
    };
    await expect(
      service.notify([ALICE], { type: 'events.cancelled', title: 'Cancelled' }),
    ).resolves.toBeUndefined();
  });

  it('tells other tabs when read state changes, but not when nothing changed', async () => {
    await service.notify([ALICE], { type: 'events.cancelled', title: 'Cancelled' });
    realtime.sent = [];
    await service.markAllRead(ALICE);
    await service.markAllRead(ALICE);
    expect(realtime.sent).toEqual([{ userId: ALICE, event: NotificationEvents.ReadChanged }]);
  });
});
