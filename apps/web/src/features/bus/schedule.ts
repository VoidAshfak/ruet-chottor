import { DISPLAY_TIME_ZONE } from '@ruet-chottor/shared';
import { help } from './help';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** The weekday (0 = Sunday) and minutes since midnight right now in Dhaka. */
export function dhakaNow(now = new Date()): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TIME_ZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** 980 -> "4:20 PM" */
export function clock12(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = String(minutes % 60).padStart(2, '0');
  return `${hours % 12 || 12}:${mins} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** [0,1,2,3,4,6] -> "Sat–Thu"; [5] -> "Friday"; otherwise short names, Saturday first. */
export function daysLabel(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return help.days.every;
  if (set.size === 6 && !set.has(5)) return help.days.working;
  if (set.size === 1 && set.has(5)) return help.days.friday;
  return help.dayOrder
    .filter((d) => set.has(d))
    .map((d) => help.dayShort[d])
    .join(', ');
}
