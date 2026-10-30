import { ROLES } from '@ruet-chottor/shared';
import { describe, expect, it } from 'vitest';
import { publishesDirectly } from './news.service.js';

describe('publishesDirectly', () => {
  it('lets only verified roles skip review (CLAUDE.md §7)', () => {
    expect(ROLES.filter(publishesDirectly)).toEqual(['club_manager', 'moderator', 'admin']);
  });
});
