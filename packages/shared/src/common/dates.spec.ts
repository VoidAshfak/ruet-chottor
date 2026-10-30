import { describe, expect, it } from 'vitest';
import { formatDateTime } from './dates.js';

describe('formatDateTime', () => {
  it('formats in Asia/Dhaka (UTC+6) as "26 Oct 2026, 3:45 PM"', () => {
    expect(formatDateTime('2026-10-26T09:45:00Z')).toBe('26 Oct 2026, 3:45 PM');
  });

  it('handles midnight and the date change', () => {
    expect(formatDateTime(new Date('2026-12-31T18:05:00Z'))).toBe('1 Jan 2027, 12:05 AM');
  });
});
