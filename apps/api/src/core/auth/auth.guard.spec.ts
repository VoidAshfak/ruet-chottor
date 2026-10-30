import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { AccessTokenStore, Principal } from './access-token.store.js';
import { AuthGuard } from './auth.guard.js';
import { Public, Roles } from './decorators.js';

class Handlers {
  @Public()
  open() {}

  closed() {}

  @Roles('moderator', 'admin')
  moderatorsOnly() {}
}

const student: Principal = { userId: 'u1', sessionId: 's1', role: 'student' };
const moderator: Principal = { userId: 'u2', sessionId: 's2', role: 'moderator' };

function run(
  handler: keyof Handlers,
  cookies: Record<string, string>,
  principal?: Principal,
  type: 'http' | 'ws' = 'http',
) {
  const tokens = { resolve: async () => principal ?? null } as unknown as AccessTokenStore;
  const guard = new AuthGuard(new Reflector(), tokens);
  const req: { cookies: Record<string, string>; user?: Principal } = { cookies };
  const context = {
    getType: () => type,
    getHandler: () => Handlers.prototype[handler],
    getClass: () => Handlers,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context).then(
    (allowed) => ({ allowed, status: 200, user: req.user }),
    (error: { getStatus: () => number }) => ({ allowed: false, status: error.getStatus() }),
  );
}

describe('AuthGuard', () => {
  it('lets anyone call a @Public() route', async () => {
    expect(await run('open', {})).toMatchObject({ allowed: true });
  });

  it('returns 401 without a valid access cookie', async () => {
    expect(await run('closed', {})).toMatchObject({ status: 401 });
    expect(await run('closed', { rc_access: 'expired' })).toMatchObject({ status: 401 });
  });

  it('attaches the principal for a valid cookie', async () => {
    expect(await run('closed', { rc_access: 't' }, student)).toMatchObject({
      allowed: true,
      user: student,
    });
  });

  it('returns 403 when the role is not allowed', async () => {
    expect(await run('moderatorsOnly', { rc_access: 't' }, student)).toMatchObject({
      status: 403,
    });
    expect(await run('moderatorsOnly', { rc_access: 't' }, moderator)).toMatchObject({
      allowed: true,
    });
  });

  it('leaves socket events to their gateway', async () => {
    expect(await run('closed', {}, undefined, 'ws')).toMatchObject({ allowed: true });
  });
});
