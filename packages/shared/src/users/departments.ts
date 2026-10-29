/**
 * RUET departments by the 2-digit code in a roll (digits 3–4 of e.g. 1703103 -> 03 = CSE).
 * Codes confirmed by the project maintainers.
 *
 * This is the ONLY place department codes live: the profile and directory read it from here.
 * If RUET changes a code, do not edit the old entry. Close it with `untilSeries` and add a new
 * entry with `fromSeries`, so rolls from earlier series keep their original department.
 */
export type Department = {
  /** Two digits as they appear in the roll. */
  code: string;
  short: string;
  name: string;
  /** First series (admission year, e.g. 2017) this code means this department. */
  fromSeries?: number;
  /** Last series this code means this department. */
  untilSeries?: number;
};

export const DEPARTMENTS: readonly Department[] = [
  { code: '00', short: 'CE', name: 'Civil Engineering' },
  { code: '01', short: 'EEE', name: 'Electrical & Electronic Engineering' },
  { code: '02', short: 'ME', name: 'Mechanical Engineering' },
  { code: '03', short: 'CSE', name: 'Computer Science & Engineering' },
  { code: '04', short: 'ETE', name: 'Electronics & Telecommunication Engineering' },
  { code: '05', short: 'IPE', name: 'Industrial & Production Engineering' },
  { code: '06', short: 'GCE', name: 'Glass & Ceramic Engineering' },
  { code: '07', short: 'URP', name: 'Urban & Regional Planning' },
  { code: '08', short: 'MTE', name: 'Mechatronics Engineering' },
  { code: '09', short: 'Arch', name: 'Architecture' },
  { code: '10', short: 'ECE', name: 'Electrical & Computer Engineering' },
  { code: '11', short: 'CFPE', name: 'Chemical & Food Process Engineering' },
  { code: '12', short: 'BECM', name: 'Building Engineering & Construction Management' },
  { code: '13', short: 'MSE', name: 'Materials Science & Engineering' },
  { code: '14', short: 'ChE', name: 'Chemical Engineering' },
];

/** `17` -> 2017. Two digits ahead of the current year are read as the 1900s (old alumni). */
export function seriesFromRoll(roll: string, today = new Date()): number | null {
  if (!/^\d{7}$/.test(roll)) return null;
  const twoDigits = Number(roll.slice(0, 2));
  const currentTwoDigits = today.getUTCFullYear() % 100;
  return twoDigits <= currentTwoDigits + 1 ? 2000 + twoDigits : 1900 + twoDigits;
}

/** The department a roll belongs to, or null for an unknown code. */
export function departmentFromRoll(
  roll: string,
  departments: readonly Department[] = DEPARTMENTS,
  today = new Date(),
): Department | null {
  const series = seriesFromRoll(roll, today);
  if (series === null) return null;
  const code = roll.slice(2, 4);
  return (
    departments.find(
      (department) =>
        department.code === code &&
        (department.fromSeries === undefined || series >= department.fromSeries) &&
        (department.untilSeries === undefined || series <= department.untilSeries),
    ) ?? null
  );
}
