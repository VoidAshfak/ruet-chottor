import { describe, expect, it } from 'vitest';
import { clubLinkSchema, clubSlug, createClubRequestSchema } from './schemas.js';

describe('clubSlug', () => {
  it('turns a name into a short URL part', () => {
    expect(clubSlug('RUET Robotics Society')).toBe('ruet-robotics-society');
    expect(clubSlug('  Debating   Club (demo)! ')).toBe('debating-club-demo');
    expect(clubSlug('Café & Culture')).toBe('cafe-culture');
  });

  it('rejects names without letters or numbers', () => {
    const club = { tagline: 'x', category: 'other', about: '', managerIds: [crypto.randomUUID()] };
    expect(createClubRequestSchema.safeParse({ ...club, name: '!!!' }).success).toBe(false);
    expect(createClubRequestSchema.safeParse({ ...club, name: 'Chess Club' }).success).toBe(true);
  });
});

describe('clubLinkSchema', () => {
  it('only accepts web links', () => {
    expect(clubLinkSchema.safeParse({ label: 'Site', url: 'https://example.com' }).success).toBe(
      true,
    );
    expect(clubLinkSchema.safeParse({ label: 'x', url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(clubLinkSchema.safeParse({ label: 'x', url: 'ftp://example.com' }).success).toBe(false);
  });
});
