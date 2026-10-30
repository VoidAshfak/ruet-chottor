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
