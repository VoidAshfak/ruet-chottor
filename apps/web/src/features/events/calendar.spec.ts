import { describe, expect, it } from 'vitest';
import { currentMonth, eventsOn, monthGrid, monthLabel, shiftMonth, timeRange } from './calendar';

describe('calendar', () => {
  it('builds Saturday-first weeks', () => {
    // 1 October 2026 is a Thursday: Sat, Sun, Mon, Tue, Wed are empty.
    const grid = monthGrid('2026-10');
    expect(grid[0]).toEqual([null, null, null, null, null, '2026-10-01', '2026-10-02']);
    expect(grid.at(-1)?.filter(Boolean).at(-1)).toBe('2026-10-31');
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it('moves between months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-10')).toBe('October 2026');
  });

  it('knows the month in Dhaka, not UTC', () => {
    expect(currentMonth(new Date('2026-10-31T19:00:00Z'))).toBe('2026-11');
  });

  it('places multi-day events on every day they cover', () => {
    const fest = { startsAt: '2026-10-26T04:00:00Z', endsAt: '2026-10-28T18:00:00Z' };
    expect(eventsOn([fest], '2026-10-25')).toEqual([]);
    expect(eventsOn([fest], '2026-10-27')).toEqual([fest]);
    // Ends at midnight Dhaka time on the 29th, so the 29th is free.
    expect(eventsOn([fest], '2026-10-29')).toEqual([]);
  });

  it('lists a day’s events earliest first', () => {
    const late = { startsAt: '2026-10-30T12:00:00Z', endsAt: '2026-10-30T13:00:00Z' };
    const early = { startsAt: '2026-10-30T04:00:00Z', endsAt: '2026-10-30T05:00:00Z' };
    expect(eventsOn([late, early], '2026-10-30')).toEqual([early, late]);
  });

  it('shortens same-day time ranges', () => {
    expect(timeRange('2026-10-26T09:45:00Z', '2026-10-26T11:45:00Z')).toBe(
      '26 Oct 2026, 3:45 PM – 5:45 PM',
    );
  });
});
