import { describe, expect, it } from 'vitest';
import { clock12, daysLabel, dhakaNow } from './schedule';

describe('bus schedule helpers', () => {
  it('reads the weekday and time in Dhaka', () => {
    // Friday 30 Oct 2026, 19:30 UTC is Saturday 01:30 in Dhaka.
    expect(dhakaNow(new Date('2026-10-30T19:30:00Z'))).toEqual({ weekday: 6, minutes: 90 });
  });

  it('formats 12-hour clock times', () => {
    expect(clock12(980)).toBe('4:20 PM');
    expect(clock12(0)).toBe('12:00 AM');
    expect(clock12(12 * 60 + 5)).toBe('12:05 PM');
  });

  it('names common day patterns', () => {
    expect(daysLabel([0, 1, 2, 3, 4, 6])).toBe('Sat–Thu');
    expect(daysLabel([5])).toBe('Friday');
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysLabel([1, 6, 3])).toBe('Sat, Mon, Wed');
  });
});
