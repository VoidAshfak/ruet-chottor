import { describe, expect, it } from 'vitest';
import { type Department, DEPARTMENTS, departmentFromRoll, seriesFromRoll } from './departments.js';

const today = new Date('2026-10-30T00:00:00Z');

describe('seriesFromRoll', () => {
  it('reads the first two digits as the admission year', () => {
    expect(seriesFromRoll('1703103', today)).toBe(2017);
    expect(seriesFromRoll('2603001', today)).toBe(2026);
  });

  it('allows next year (admissions can start early) and reads later years as the 1900s', () => {
    expect(seriesFromRoll('2703001', today)).toBe(2027);
    expect(seriesFromRoll('9903001', today)).toBe(1999);
  });

  it('returns null for a malformed roll', () => {
    expect(seriesFromRoll('17031', today)).toBeNull();
  });
});

describe('departmentFromRoll', () => {
  it('maps the department code', () => {
    expect(departmentFromRoll('1703103', DEPARTMENTS, today)?.short).toBe('CSE');
    expect(departmentFromRoll('2100045', DEPARTMENTS, today)?.short).toBe('CE');
  });

  it('returns null for an unknown code', () => {
    expect(departmentFromRoll('1799001', DEPARTMENTS, today)).toBeNull();
  });

  it('has unique codes in the current table', () => {
    const open = DEPARTMENTS.filter((d) => d.untilSeries === undefined).map((d) => d.code);
    expect(new Set(open).size).toBe(open.length);
  });

  it('respects series ranges when a code changes meaning', () => {
    const table: Department[] = [
      { code: '15', short: 'OLD', name: 'Old Department', untilSeries: 2019 },
      { code: '15', short: 'NEW', name: 'New Department', fromSeries: 2020 },
    ];
    expect(departmentFromRoll('1915001', table, today)?.short).toBe('OLD');
    expect(departmentFromRoll('2015001', table, today)?.short).toBe('NEW');
  });
});
