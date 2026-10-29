import { describe, expect, it } from 'vitest';
import { enabledModules, featureEnvVar } from './modules.js';

describe('featureEnvVar', () => {
  it('turns a module key into an env var name', () => {
    expect(featureEnvVar('chat')).toBe('FEATURE_CHAT');
    expect(featureEnvVar('lost-found')).toBe('FEATURE_LOST_FOUND');
  });
});

describe('enabledModules', () => {
  it('returns only modules whose flag is exactly "true"', () => {
    const env = { FEATURE_CHAT: 'true', FEATURE_NEWS: 'false', FEATURE_BUS: '1' };
    expect(enabledModules(env)).toEqual(['chat']);
  });

  it('keeps the registry order', () => {
    const env = { FEATURE_BUS: 'true', FEATURE_AUTH: 'true' };
    expect(enabledModules(env)).toEqual(['auth', 'bus']);
  });
});
