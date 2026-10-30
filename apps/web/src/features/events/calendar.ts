import { dhakaDateKey, formatDateTime } from '@ruet-chottor/shared';

// Calendar arithmetic on "YYYY-MM" months and "YYYY-MM-DD" day keys, all in Dhaka time.

const pad = (n: number) => String(n).padStart(2, '0');
const parse = (month: string) => month.split('-').map(Number) as [number, number];

export function currentMonth(now = new Date()): string {
  return dhakaDateKey(now).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = parse(month);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/**
 * The month's day keys in rows of seven, starting on Saturday (the Bangladeshi week).
 * Days outside the month are null.
 */
export function monthGrid(month: string): (string | null)[][] {
  const [year, index] = parse(month);
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  // getUTCDay: Sunday 0 ... Saturday 6; shift so Saturday is the first column.
  const lead = (new Date(Date.UTC(year, index - 1, 1)).getUTCDay() + 1) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

/** Events on a day, including multi-day events that span it, earliest first. */
export function eventsOn<T extends { startsAt: string; endsAt: string }>(
  events: T[],
  day: string,
): T[] {
  return events
    .filter((event) => {
      const first = dhakaDateKey(event.startsAt);
      // An event ending exactly at midnight does not spill into the next day.
      const last = dhakaDateKey(new Date(Date.parse(event.endsAt) - 1));
      return first <= day && day <= last;
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function monthLabel(month: string): string {
  const [year, index] = parse(month);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, index - 1, 15)));
}

/** "Monday, 26 October" */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/** "26 Oct 2026, 3:45 PM – 5:45 PM", or both full dates when it spans days. */
export function timeRange(startsAt: string, endsAt: string): string {
  const start = formatDateTime(startsAt);
  const end = formatDateTime(endsAt);
  if (dhakaDateKey(startsAt) === dhakaDateKey(endsAt)) return `${start} – ${end.split(', ')[1]}`;
  return `${start} – ${end}`;
}
