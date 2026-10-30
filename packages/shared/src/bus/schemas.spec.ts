import { describe, expect, it } from 'vitest';
import {
  type BusRoute,
  busRouteInputSchema,
  clockToMinutes,
  departuresFrom,
  minutesToClock,
} from './schemas.js';

const route: BusRoute = {
  id: 'r1',
  name: 'Route A (demo)',
  description: '',
  color: 'blue',
  active: true,
  updatedAt: '2026-10-30T00:00:00Z',
  stops: [
    { id: 's1', name: 'Campus', minutesFromCampus: 0 },
    { id: 's2', name: 'Talaimari', minutesFromCampus: 10 },
    { id: 's3', name: 'Railway station', minutesFromCampus: 30 },
  ],
  trips: [
    {
      id: 't1',
      direction: 'from_campus',
      departsAt: '16:00',
      days: [0, 1, 2, 3, 4, 6],
      note: null,
    },
    { id: 't2', direction: 'to_campus', departsAt: '07:30', days: [0, 1, 2, 3, 4, 6], note: null },
    { id: 't3', direction: 'from_campus', departsAt: '18:00', days: [5], note: 'Friday only' },
  ],
};

describe('bus times', () => {
  it('converts clock times', () => {
    expect(clockToMinutes('16:20')).toBe(980);
    expect(minutesToClock(980)).toBe('16:20');
    expect(minutesToClock(-10)).toBe('23:50');
  });

  it('times each stop from the trip’s first stop, in both directions', () => {
    // Sunday (0), from 07:00.
    const talaimari = departuresFrom([route], 'Talaimari', 0, 7 * 60);
    expect(talaimari.map((d) => [d.direction, minutesToClock(d.atMinutes)])).toEqual([
      ['to_campus', '07:50'], // leaves the station at 07:30, 20 minutes away
      ['from_campus', '16:10'], // leaves campus at 16:00, 10 minutes away
    ]);
  });

  it('skips past trips, other days, and stops where a trip ends', () => {
    expect(departuresFrom([route], 'Talaimari', 0, 12 * 60).map((d) => d.atMinutes)).toEqual([970]);
    expect(departuresFrom([route], 'Talaimari', 5, 0).map((d) => d.note)).toEqual(['Friday only']);
    // Campus is where to_campus trips end, the station where from_campus trips end.
    expect(departuresFrom([route], 'Campus', 0, 0).map((d) => d.direction)).toEqual([
      'from_campus',
    ]);
    expect(departuresFrom([route], 'Railway station', 0, 0).map((d) => d.direction)).toEqual([
      'to_campus',
    ]);
    expect(departuresFrom([{ ...route, active: false }], 'Talaimari', 0, 0)).toEqual([]);
  });

  it('checks that stops start at campus and get further away', () => {
    const input = {
      name: 'Route A',
      description: '',
      color: 'blue',
      active: true,
      stops: [
        { name: 'Campus', minutesFromCampus: 0 },
        { name: 'Talaimari', minutesFromCampus: 10 },
      ],
      trips: [],
    };
    expect(busRouteInputSchema.safeParse(input).success).toBe(true);
    expect(
      busRouteInputSchema.safeParse({
        ...input,
        stops: [input.stops[0], { name: 'Back', minutesFromCampus: 0 }],
      }).success,
    ).toBe(false);
    expect(
      busRouteInputSchema.safeParse({
        ...input,
        stops: [{ name: 'Talaimari', minutesFromCampus: 5 }, input.stops[1]],
      }).success,
    ).toBe(false);
  });
});
