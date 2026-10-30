import { describe, expect, it } from 'vitest';
import { createReportRequestSchema, myReportsQuerySchema } from './schemas.js';

const uuid = (n: number) => `0190f0e0-0000-7000-8000-${String(n).padStart(12, '0')}`;

describe('moderation schemas', () => {
  it('accepts a report with an optional note and treats an empty note as none', () => {
    const parsed = createReportRequestSchema.parse({
      contentType: 'chat.message',
      contentId: uuid(1),
      reason: 'spam',
      note: '',
    });
    expect(parsed.note).toBeUndefined();
  });

  it('rejects unknown content types, reasons and extra fields', () => {
    const base = { contentType: 'chat.message', contentId: uuid(1), reason: 'spam' };
    expect(
      createReportRequestSchema.safeParse({ ...base, contentType: 'events.event' }).success,
    ).toBe(false);
    expect(createReportRequestSchema.safeParse({ ...base, reason: 'boring' }).success).toBe(false);
    expect(createReportRequestSchema.safeParse({ ...base, reporterId: uuid(2) }).success).toBe(
      false,
    );
  });

  it('splits the ids of a "did I report these?" query and caps them at 100', () => {
    expect(
      myReportsQuerySchema.parse({ contentType: 'chat.message', ids: `${uuid(1)},${uuid(2)}` }).ids,
    ).toEqual([uuid(1), uuid(2)]);
    const many = Array.from({ length: 101 }, (_, i) => uuid(i)).join(',');
    expect(myReportsQuerySchema.safeParse({ contentType: 'chat.message', ids: many }).success).toBe(
      false,
    );
  });
});
