import { MODULE_KEYS } from '@ruet-chottor/shared';
import { describe, expect, it } from 'vitest';
import { enabledNavModules, NAV_MODULES } from './modules';

describe('NAV_MODULES', () => {
  it('only uses registered module keys, each once', () => {
    const keys = NAV_MODULES.map((module) => module.key);
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((key) => expect(MODULE_KEYS).toContain(key));
  });
});

describe('enabledNavModules', () => {
  it('keeps navigation order and drops non-nav modules', () => {
    const result = enabledNavModules(['bus', 'admin', 'chat']);
    expect(result.map((module) => module.key)).toEqual(['chat', 'bus']);
  });
});
