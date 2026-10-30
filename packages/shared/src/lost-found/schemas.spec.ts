import { describe, expect, it } from 'vitest';
import { lostFoundInputSchema } from './schemas.js';

const base = {
  kind: 'found',
  category: 'wallet',
  title: 'Brown wallet',
  description: '',
  place: 'cafeteria',
  placeDetail: '',
  happenedOn: '2026-10-28',
  verifyQuestion: '',
};

describe('lostFoundInputSchema', () => {
  it('treats empty optional fields as none and starts with no photos', () => {
    expect(lostFoundInputSchema.parse(base)).toMatchObject({
      placeDetail: null,
      verifyQuestion: null,
      mediaIds: [],
    });
  });

  it('allows a check question only on found items', () => {
    const question = { verifyQuestion: 'What is inside?' };
    expect(lostFoundInputSchema.safeParse({ ...base, ...question }).success).toBe(true);
    expect(lostFoundInputSchema.safeParse({ ...base, ...question, kind: 'lost' }).success).toBe(
      false,
    );
  });

  it('needs a real date and at most 3 photos', () => {
    expect(lostFoundInputSchema.safeParse({ ...base, happenedOn: '2026-13-01' }).success).toBe(
      false,
    );
    const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
    expect(lostFoundInputSchema.safeParse({ ...base, mediaIds: ids }).success).toBe(false);
  });
});
