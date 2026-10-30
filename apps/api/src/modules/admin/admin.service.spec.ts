import { beforeEach, describe, expect, it } from 'vitest';
import { FakePrisma } from '../../../test/fakes/fake-prisma.js';
import { FakeRedis } from '../../../test/fakes/fake-redis.js';
import type { MailService } from '../../core/mail/mail.service.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { RedisService } from '../../core/redis/redis.service.js';
import type { User } from '../../generated/prisma/client.js';
import type { SessionsService } from '../auth/sessions.service.js';
import { AdminService } from './admin.service.js';
import { ModerationLogService } from './moderation-log.service.js';

const REASON = 'Repeated spam in comments';

describe('AdminService', () => {
  let prisma: FakePrisma;
  let admin: AdminService;
  let revoked: string[];
  let moderator: User;
  let student: User;

  beforeEach(async () => {
    prisma = new FakePrisma();
    revoked = [];
    const db = prisma as unknown as PrismaService;
    admin = new AdminService(
      db,
      new ModerationLogService(db),
      {
        revokeAllForUser: async (id: string) => void revoked.push(id),
      } as unknown as SessionsService,
      { send: async () => Promise.reject(new Error('SMTP down')) } as unknown as MailService,
      new RateLimitService({ client: new FakeRedis() } as unknown as RedisService),
    );
    moderator = await prisma.user.create({
      data: { name: 'Demo Moderator', roll: '0000002', role: 'moderator' },
    });
    student = await prisma.user.create({
      data: { name: 'Demo Student', roll: '1703999', email: 'student@example.com' },
    });
  });

  it('suspends even when the notification email fails', async () => {
    const detail = await admin.suspend(moderator.id, student.id, REASON, 3);
    expect(detail.user.status).toBe('suspended');
    expect(revoked).toEqual([student.id]);
    expect(prisma.moderationLogs).toHaveLength(1);
  });

  it('a banned member must be reinstated before a suspension', async () => {
    await admin.ban(moderator.id, student.id, REASON);
    await expect(admin.suspend(moderator.id, student.id, REASON, 3)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('a suspended moderator can no longer act', async () => {
    moderator.status = 'suspended';
    await expect(admin.warn(moderator.id, student.id, REASON)).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.moderationLogs).toHaveLength(0);
  });

  it('only admins change roles', async () => {
    await expect(
      admin.changeRole(moderator.id, student.id, 'moderator', REASON),
    ).rejects.toMatchObject({ status: 403 });
  });
});
