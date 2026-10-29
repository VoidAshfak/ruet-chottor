import type { ConfigService } from '@nestjs/config';
import { AUTH_LIMITS } from '@ruet-chottor/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeRedis } from '../../../test/fakes/fake-redis.js';
import type { Env } from '../../core/config/env.js';
import type { RedisService } from '../../core/redis/redis.service.js';
import { OtpService } from './otp.service.js';

const errorCode = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: { response?: { code?: string } }) => error.response?.code,
  );

describe('OtpService', () => {
  let redis: FakeRedis;
  let otp: OtpService;
  let clock: number;

  beforeEach(() => {
    redis = new FakeRedis();
    clock = Date.now();
    redis.now = () => clock;
    const config = { get: () => 'x'.repeat(32) } as unknown as ConfigService<Env, true>;
    otp = new OtpService({ client: redis } as unknown as RedisService, config);
  });

  it('accepts the right code once', async () => {
    const { challengeId, code } = await otp.issue('user-1');
    expect(code).toMatch(/^\d{6}$/);
    await expect(otp.verify(challengeId, code)).resolves.toBe('user-1');
    expect(await errorCode(otp.verify(challengeId, code))).toBe('OTP_EXPIRED');
  });

  it('never stores the code in plain text', async () => {
    const { code } = await otp.issue('user-1');
    for (const key of redis.keys()) {
      expect(await redis.get(key)).not.toContain(code);
    }
  });

  it('locks the challenge after the maximum wrong attempts', async () => {
    const { challengeId, code } = await otp.issue('user-1');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < AUTH_LIMITS.otpMaxAttempts; i += 1) {
      expect(await errorCode(otp.verify(challengeId, wrong))).toBe('OTP_INVALID');
    }
    expect(await errorCode(otp.verify(challengeId, code))).toBe('OTP_EXPIRED');
  });

  it('expires after 5 minutes', async () => {
    const { challengeId, code } = await otp.issue('user-1');
    clock += AUTH_LIMITS.otpSeconds * 1000 + 1;
    expect(await errorCode(otp.verify(challengeId, code))).toBe('OTP_EXPIRED');
  });

  it('enforces the resend cooldown and replaces the code', async () => {
    const first = await otp.issue('user-1');
    expect(await errorCode(otp.resend(first.challengeId))).toBe('RATE_LIMITED');

    clock += AUTH_LIMITS.otpResendCooldownSeconds * 1000 + 1;
    const second = await otp.resend(first.challengeId);
    expect(second.userId).toBe('user-1');
    if (second.code !== first.code) {
      expect(await errorCode(otp.verify(first.challengeId, first.code))).toBe('OTP_INVALID');
    }
    await expect(otp.verify(first.challengeId, second.code)).resolves.toBe('user-1');
  });

  it('limits the number of resends', async () => {
    const { challengeId } = await otp.issue('user-1');
    for (let i = 0; i < AUTH_LIMITS.otpMaxResends; i += 1) {
      clock += AUTH_LIMITS.otpResendCooldownSeconds * 1000 + 1;
      await otp.resend(challengeId);
    }
    clock += AUTH_LIMITS.otpResendCooldownSeconds * 1000 + 1;
    expect(await errorCode(otp.resend(challengeId))).toBe('RATE_LIMITED');
  });
});
