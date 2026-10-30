import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('applies defaults when nothing is set', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
      MAIL_FROM: '"RUET Chottor" <no-reply@example.com>',
      CHAT_SEND_LIMIT_PER_MINUTE: 30,
      MODERATION_AUTO_HIDE_REPORTS: 5,
      ENABLED_MODULES: [],
    });
  });

  it('treats empty values as not set', () => {
    const env = validateEnv({ DATABASE_URL: '', REDIS_URL: '' });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('collects enabled feature flags', () => {
    expect(validateEnv({ FEATURE_CHAT: 'true', FEATURE_NEWS: 'false' }).ENABLED_MODULES).toEqual([
      'chat',
    ]);
  });

  it('keeps feature flags so ConditionalModule can read them from process.env', () => {
    expect(validateEnv({ FEATURE_AUTH: 'true' })).toMatchObject({ FEATURE_AUTH: 'true' });
  });

  it('requires the hosted services and secrets in production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/OTP_SECRET/);
  });

  it('rejects an invalid value', () => {
    expect(() => validateEnv({ DATABASE_URL: 'not a url' })).toThrow(/DATABASE_URL/);
  });
});
