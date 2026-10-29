import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_LIMITS, ERROR_CODES } from '@ruet-chottor/shared';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { hashToken, newToken } from '../../core/auth/tokens.js';
import type { Env } from '../../core/config/env.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { requireRedis } from '../../core/redis/require-redis.js';

const challengeSchema = z.object({
  userId: z.string(),
  codeHash: z.string(),
  resends: z.number().int(),
});

type Challenge = z.infer<typeof challengeSchema>;

export interface IssuedCode {
  challengeId: string;
  code: string;
}

const expired = () =>
  new BadRequestException({
    code: ERROR_CODES.OTP_EXPIRED,
    message: 'This code has expired. Please log in again.',
  });

/**
 * One-time login codes (CLAUDE.md §6): stored only as an HMAC in Redis, valid for 5 minutes,
 * at most 5 wrong tries, 60 s between resends. Never logs a code.
 */
@Injectable()
export class OtpService {
  private readonly secret: Buffer;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<Env, true>,
  ) {
    const secret = config.get('OTP_SECRET', { infer: true });
    if (!secret) {
      // env.ts requires OTP_SECRET in production. In development a per-process secret is fine:
      // a restart only invalidates codes that are at most 5 minutes old.
      new Logger(OtpService.name).warn('OTP_SECRET not set: using a random secret for this run');
    }
    this.secret = secret ? Buffer.from(secret) : randomBytes(32);
  }

  async issue(userId: string): Promise<IssuedCode> {
    const challengeId = newToken();
    const code = this.generateCode();
    const client = requireRedis(this.redis);
    const challenge: Challenge = { userId, codeHash: this.hash(challengeId, code), resends: 0 };
    await client
      .multi()
      .set(keys.challenge(challengeId), JSON.stringify(challenge), 'EX', AUTH_LIMITS.otpSeconds)
      .set(keys.cooldown(challengeId), '1', 'EX', AUTH_LIMITS.otpResendCooldownSeconds)
      .exec();
    return { challengeId, code };
  }

  /** Returns the user id when the code is right; the challenge can be used only once. */
  async verify(challengeId: string, code: string): Promise<string> {
    const client = requireRedis(this.redis);
    const challenge = await this.load(challengeId);

    // INCR is atomic, so parallel guesses cannot get more than the allowed attempts.
    const attemptsKey = keys.attempts(challengeId);
    const attempts = await client.incr(attemptsKey);
    if (attempts === 1) await client.expire(attemptsKey, AUTH_LIMITS.otpSeconds);
    if (attempts > AUTH_LIMITS.otpMaxAttempts) {
      await this.discard(challengeId);
      throw new BadRequestException({
        code: ERROR_CODES.OTP_EXPIRED,
        message: 'Too many wrong codes. Please log in again.',
      });
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const actual = Buffer.from(this.hash(challengeId, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      const left = AUTH_LIMITS.otpMaxAttempts - attempts;
      throw new BadRequestException({
        code: ERROR_CODES.OTP_INVALID,
        message:
          left > 0
            ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.`
            : 'Wrong code. Please log in again.',
      });
    }

    // DEL returns 0 if a parallel request already used this challenge.
    const deleted = await client.del(keys.challenge(challengeId));
    if (deleted === 0) throw expired();
    await client.del(attemptsKey, keys.cooldown(challengeId));
    return challenge.userId;
  }

  /** Replaces the code (same challenge, same expiry). Wrong-attempt count is kept. */
  async resend(challengeId: string): Promise<IssuedCode & { userId: string }> {
    const client = requireRedis(this.redis);
    const challenge = await this.load(challengeId);

    if (challenge.resends >= AUTH_LIMITS.otpMaxResends) {
      throw new HttpException(
        { code: ERROR_CODES.RATE_LIMITED, message: 'No more resends. Please log in again.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const cooldown = await client.set(
      keys.cooldown(challengeId),
      '1',
      'EX',
      AUTH_LIMITS.otpResendCooldownSeconds,
      'NX',
    );
    if (cooldown === null) {
      const wait = await client.ttl(keys.cooldown(challengeId));
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: `Please wait ${Math.max(wait, 1)} seconds before asking for a new code.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateCode();
    const updated: Challenge = {
      ...challenge,
      codeHash: this.hash(challengeId, code),
      resends: challenge.resends + 1,
    };
    await client.set(keys.challenge(challengeId), JSON.stringify(updated), 'KEEPTTL');
    return { challengeId, code, userId: challenge.userId };
  }

  private async load(challengeId: string): Promise<Challenge> {
    const raw = await requireRedis(this.redis).get(keys.challenge(challengeId));
    if (!raw) throw expired();
    const parsed = challengeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw expired();
    return parsed.data;
  }

  private async discard(challengeId: string) {
    await requireRedis(this.redis).del(
      keys.challenge(challengeId),
      keys.attempts(challengeId),
      keys.cooldown(challengeId),
    );
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hash(challengeId: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${challengeId}:${code}`).digest('hex');
  }
}

// Challenge ids are hashed in key names so a Redis dump does not reveal usable ids.
const keys = {
  challenge: (id: string) => `auth:otp:${hashToken(id)}`,
  attempts: (id: string) => `auth:otp:${hashToken(id)}:attempts`,
  cooldown: (id: string) => `auth:otp:${hashToken(id)}:cooldown`,
};
