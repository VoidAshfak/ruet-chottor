/** Every date shown to users is in Bangladesh time (CLAUDE.md §9). */
export const DISPLAY_TIME_ZONE = 'Asia/Dhaka';

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** `26 Oct 2026, 3:45 PM` in Asia/Dhaka, the same on the server and in every browser. */
export function formatDateTime(value: Date | string): string {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.formatToParts(new Date(value)).find((part) => part.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
}

/** Bangladesh has no daylight saving time, so Dhaka is always UTC+6. */
export const DHAKA_OFFSET = '+06:00';

const dayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Dhaka, as "2026-10-26". Groups events by the day students see. */
export function dhakaDateKey(value: Date | string): string {
  return dayParts.format(new Date(value));
}

/** "2026-10" -> the instants where that month starts and ends in Dhaka. */
export function dhakaMonthRange(month: string): { from: Date; to: Date } {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  const next =
    monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return {
    from: new Date(`${month}-01T00:00:00${DHAKA_OFFSET}`),
    to: new Date(`${next}-01T00:00:00${DHAKA_OFFSET}`),
  };
}

/** A `<input type="datetime-local">` value ("2026-10-26T15:45") read as Dhaka time. */
export function fromDhakaLocal(value: string): string {
  return new Date(`${value}:00${DHAKA_OFFSET}`).toISOString();
}

/** The reverse: an instant as a Dhaka `datetime-local` value. */
export function toDhakaLocal(value: Date | string): string {
  const shifted = new Date(new Date(value).getTime() + 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}
