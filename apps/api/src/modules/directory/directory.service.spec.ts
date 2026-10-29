import { directoryQuerySchema } from '@ruet-chottor/shared';
import { describe, expect, it } from 'vitest';
import { directoryWhere } from './directory.service.js';

const where = (query: Record<string, string>) => directoryWhere(directoryQuerySchema.parse(query));

describe('directoryWhere', () => {
  it('searches names case-insensitively and rolls by prefix', () => {
    expect(where({ q: 'Rafiq' })).toEqual({
      AND: [{ name: { contains: 'Rafiq', mode: 'insensitive' } }],
    });
    expect(where({ q: '1703' })).toEqual({ AND: [{ roll: { startsWith: '1703' } }] });
  });

  it('turns department and series into roll prefixes', () => {
    expect(where({ department: 'CSE', series: '2017' })).toEqual({
      AND: [{ OR: [{ roll: { startsWith: '1703' } }] }],
    });
  });

  it('treats empty parameters as "any"', () => {
    expect(where({ q: '', department: '', series: '', role: '' })).toEqual({ AND: [] });
  });

  it('filters by role', () => {
    expect(where({ role: 'alumni' })).toEqual({ AND: [{ role: 'alumni' }] });
  });

  it('rejects unknown departments and roles', () => {
    expect(directoryQuerySchema.safeParse({ department: 'XYZ' }).success).toBe(false);
    expect(directoryQuerySchema.safeParse({ role: 'admin' }).success).toBe(false);
  });
});
