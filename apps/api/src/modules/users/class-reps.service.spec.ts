import { beforeEach, describe, expect, it } from 'vitest';
import { FakePrisma } from '../../../test/fakes/fake-prisma.js';
import { FakeRedis } from '../../../test/fakes/fake-redis.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { RedisService } from '../../core/redis/redis.service.js';
import type { User } from '../../generated/prisma/client.js';
import { ModerationLogService } from '../admin/moderation-log.service.js';
import { ClassRepsService } from './class-reps.service.js';

const APPLY = { section: 'B' as const, note: 'Elected by the class on the first day of term.' };

describe('ClassRepsService', () => {
  let prisma: FakePrisma;
  let classReps: ClassRepsService;
  let student: User;
  let moderator: User;

  beforeEach(async () => {
    prisma = new FakePrisma();
    const db = prisma as unknown as PrismaService;
    const rateLimit = new RateLimitService({ client: new FakeRedis() } as unknown as RedisService);
    classReps = new ClassRepsService(db, rateLimit, new ModerationLogService(db));
    student = await prisma.user.create({
      data: { name: 'Test Student', roll: '2203101', role: 'student' },
    });
    moderator = await prisma.user.create({
      data: { name: 'Test Moderator', roll: '1903050', role: 'moderator' },
    });
  });

  it('turns a race past the open-request check into a friendly conflict', async () => {
    const results = await Promise.allSettled([
      classReps.apply(student.id, APPLY),
      classReps.apply(student.id, APPLY),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { status: 409 },
    });
    expect(prisma.classRepRequests).toHaveLength(1);
  });

  it('writes the log entry and the decision together, against the member', async () => {
    const { request } = await classReps.apply(student.id, APPLY);
    await classReps.approve(moderator.id, request!.id);
    expect(prisma.moderationLogs).toHaveLength(1);
    expect(prisma.moderationLogs[0]).toMatchObject({
      action: 'verify_class_rep',
      targetUserId: student.id,
      details: { requestId: request!.id, section: 'B' },
    });
    expect(prisma.classRepRequests[0]).toMatchObject({
      status: 'approved',
      reviewedById: moderator.id,
    });
  });

  it('works without the notifications module', async () => {
    const { request } = await classReps.apply(student.id, APPLY);
    await expect(
      classReps.reject(moderator.id, request!.id, 'Your class has not confirmed this yet.'),
    ).resolves.toMatchObject({ status: 'rejected' });
  });

  it('re-checks staff rights from the database', async () => {
    const { request } = await classReps.apply(student.id, APPLY);
    moderator.role = 'student';
    await expect(classReps.approve(moderator.id, request!.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rate-limits asking', async () => {
    for (let i = 0; i < 5; i += 1) {
      await classReps.apply(student.id, APPLY);
      await classReps.withdraw(student.id);
    }
    await expect(classReps.apply(student.id, APPLY)).rejects.toMatchObject({ status: 429 });
  });
});
