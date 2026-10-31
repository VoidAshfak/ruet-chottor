import { beforeEach, describe, expect, it } from 'vitest';
import { FakePrisma } from '../../../test/fakes/fake-prisma.js';
import { FakeRedis } from '../../../test/fakes/fake-redis.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import { RateLimitService } from '../../core/rate-limit/rate-limit.service.js';
import type { RedisService } from '../../core/redis/redis.service.js';
import type { User } from '../../generated/prisma/client.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let prisma: FakePrisma;
  let users: UsersService;
  let user: User;

  beforeEach(async () => {
    prisma = new FakePrisma();
    const rateLimit = new RateLimitService({ client: new FakeRedis() } as unknown as RedisService);
    users = new UsersService(prisma as unknown as PrismaService, rateLimit);
    user = await prisma.user.create({
      data: {
        name: 'Test Student',
        roll: '1703103',
        email: 'test.student@example.com',
        phone: '+8801700000001',
        dateOfBirth: new Date('2003-05-14'),
        passwordHash: '$argon2id$not-a-real-hash',
      },
    });
  });

  it('hides email and phone by default and derives department and series from the roll', async () => {
    const profile = await users.getPublic(user.id);
    expect(profile).toEqual({
      id: user.id,
      name: 'Test Student',
      roll: '1703103',
      role: 'student',
      department: { code: '03', short: 'CSE', name: 'Computer Science & Engineering' },
      series: 2017,
      email: null,
      phone: null,
      classRep: null,
    });
  });

  it('never exposes the password hash or date of birth', async () => {
    const mine = await users.getMine(user.id);
    expect(Object.keys(mine)).not.toEqual(expect.arrayContaining(['passwordHash']));
    expect(JSON.stringify(mine)).not.toContain('2003-05-14');
    expect(JSON.stringify(mine)).not.toContain('argon2');
  });

  it('shows only the contact fields the owner opted in to', async () => {
    await users.updateMine(user.id, { showEmail: true });
    const profile = await users.getPublic(user.id);
    expect(profile.email).toBe('test.student@example.com');
    expect(profile.phone).toBeNull();
  });

  it('always shows the owner their own contact details', async () => {
    const mine = await users.getMine(user.id);
    expect(mine).toMatchObject({
      email: 'test.student@example.com',
      phone: '+8801700000001',
      showEmail: false,
      showPhone: false,
    });
  });

  it('hides suspended members from others', async () => {
    user.status = 'suspended';
    await expect(users.getPublic(user.id)).rejects.toMatchObject({ status: 404 });
  });

  it('records each dismissed guide once and can reset them', async () => {
    await users.dismissGuide(user.id, 'home');
    await users.dismissGuide(user.id, 'home');
    await expect(users.dismissGuide(user.id, 'users')).resolves.toEqual(['home', 'users']);
    await expect(users.resetGuides(user.id)).resolves.toEqual([]);
    expect((await users.getMine(user.id)).dismissedGuides).toEqual([]);
  });

  it('rate-limits profile updates', async () => {
    for (let i = 0; i < 30; i += 1) await users.updateMine(user.id, { showPhone: i % 2 === 0 });
    await expect(users.updateMine(user.id, { showPhone: true })).rejects.toMatchObject({
      status: 429,
    });
  });
});
