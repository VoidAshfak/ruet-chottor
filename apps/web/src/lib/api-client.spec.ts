import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiRequest } from './api-client';

const schema = z.object({ ok: z.boolean() });

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('returns parsed data and always sends cookies', async () => {
    mockFetch(async () => Response.json({ ok: true }));
    await expect(apiRequest('/x', schema)).resolves.toEqual({ ok: true });
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('sends JSON bodies with a content type', async () => {
    mockFetch(async () => Response.json({ ok: true }));
    await apiRequest('/x', schema, { method: 'POST', body: { a: 1 } });
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('turns the API error shape into an ApiError', async () => {
    mockFetch(async () =>
      Response.json({ error: { code: 'NOT_FOUND', message: 'No such club.' } }, { status: 404 }),
    );
    await expect(apiRequest('/x', schema)).rejects.toEqual(
      new ApiError(404, 'NOT_FOUND', 'No such club.'),
    );
  });

  it('reports network failures', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(apiRequest('/x', schema)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
