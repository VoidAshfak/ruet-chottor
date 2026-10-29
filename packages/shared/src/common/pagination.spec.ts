import { describe, expect, it } from 'vitest';
import { cursorPageQuerySchema, PAGE_SIZE_DEFAULT } from './pagination.js';

describe('cursorPageQuerySchema', () => {
  it('applies the default page size', () => {
    expect(cursorPageQuerySchema.parse({})).toEqual({ limit: PAGE_SIZE_DEFAULT });
  });

  it('coerces limit from a query string', () => {
    expect(cursorPageQuerySchema.parse({ limit: '50', cursor: 'abc' })).toEqual({
      limit: 50,
      cursor: 'abc',
    });
  });

  it('rejects a limit above the maximum', () => {
    expect(cursorPageQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
