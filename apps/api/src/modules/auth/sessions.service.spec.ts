import { beforeEach, describe, expect, it } from 'vitest';
import { FakePrisma } from '../../../test/fakes/fake-prisma.js';
import { FakeRedis } from '../../../test/fakes/fake-redis.js';
import { AccessTokenStore } from '../../core/auth/access-token.store.js';
import type { PrismaService } from '../../core/prisma/prisma.service.js';
import type { RedisService } from '../../core/redis/redis.service.js';
import type { User } from '../../generated/prisma/client.js';
import { SessionsService } from './sessions.service.js';

describe('SessionsService', () => {
  let prisma: FakePrisma;
  let accessTokens: AccessTokenStore;
  let sessions: SessionsService;
  let user: User;

  beforeEach(async () => {
    prisma = new FakePrisma();
    accessTokens = new AccessTokenStore({ client: new FakeRedis() } as unknown as RedisService);
    sessions = new SessionsService(prisma as unknown as PrismaService, accessTokens);
    user = await prisma.user.create({ data: { name: 'Test Student', roll: '2103001' } });
  });

  it('issues an access token that resolves to the user', async () => {
    const issued = await sessions.create(user, 'vitest');
    await expect(accessTokens.resolve(issued.accessToken)).resolves.toMatchObject({
      userId: user.id,
      role: 'student',
    });
    expect(prisma.sessions[0]?.refreshTokenHash).not.toBe(issued.refreshToken);
  });

  it('rotates the refresh token', async () => {
    const first = await sessions.create(user, undefined);
    const second = await sessions.rotate(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(sessions.rotate(second.refreshToken)).resolves.toBeDefined();
  });

  it('revokes the session when an old refresh token is reused later', async () => {
    const first = await sessions.create(user, undefined);
    const second = await sessions.rotate(first.refreshToken);
    prisma.sessions[0]!.lastUsedAt = new Date(Date.now() - 60_000);

    await expect(sessions.rotate(first.refreshToken)).rejects.toThrow();
    expect(prisma.sessions[0]?.revokedAt).not.toBeNull();
    await expect(sessions.rotate(second.refreshToken)).rejects.toThrow();
  });

  it('does not revoke on a near-simultaneous double refresh', async () => {
    const first = await sessions.create(user, undefined);
    const second = await sessions.rotate(first.refreshToken);
    await expect(sessions.rotate(first.refreshToken)).rejects.toThrow();
    await expect(sessions.rotate(second.refreshToken)).resolves.toBeDefined();
  });

  it('refuses to refresh for a suspended user or a revoked session', async () => {
    const issued = await sessions.create(user, undefined);
    user.status = 'suspended';
    await expect(sessions.rotate(issued.refreshToken)).rejects.toThrow();

    user.status = 'active';
    await sessions.revokeByRefreshToken(issued.refreshToken);
    await expect(sessions.rotate(issued.refreshToken)).rejects.toThrow();
  });
});
