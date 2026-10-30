import { describe, expect, it } from 'vitest';
import {
  dhakaDateKey,
  dhakaMonthRange,
  formatDateTime,
  fromDhakaLocal,
  toDhakaLocal,
} from './dates.js';

describe('formatDateTime', () => {
  it('formats in Asia/Dhaka (UTC+6) as "26 Oct 2026, 3:45 PM"', () => {
    expect(formatDateTime('2026-10-26T09:45:00Z')).toBe('26 Oct 2026, 3:45 PM');
  });

  it('handles midnight and the date change', () => {
    expect(formatDateTime(new Date('2026-12-31T18:05:00Z'))).toBe('1 Jan 2027, 12:05 AM');
  });
});

describe('Dhaka calendar helpers', () => {
  it('puts a late-evening UTC time on the next Dhaka day', () => {
    expect(dhakaDateKey('2026-10-26T19:00:00Z')).toBe('2026-10-27');
    expect(dhakaDateKey('2026-10-26T17:59:00Z')).toBe('2026-10-26');
  });

  it('gives month ranges in Dhaka time, including December', () => {
    expect(dhakaMonthRange('2026-12')).toEqual({
      from: new Date('2026-11-30T18:00:00Z'),
      to: new Date('2026-12-31T18:00:00Z'),
    });
  });

  it('round-trips datetime-local values as Dhaka time', () => {
    expect(fromDhakaLocal('2026-10-26T15:45')).toBe('2026-10-26T09:45:00.000Z');
    expect(toDhakaLocal('2026-10-26T09:45:00.000Z')).toBe('2026-10-26T15:45');
  });
});
