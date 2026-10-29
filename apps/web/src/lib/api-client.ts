import { apiErrorSchema } from '@ruet-chottor/shared';
import type { z } from 'zod';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** An error response from the API, or a network failure (code `NETWORK_ERROR`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * Calls the API and validates the response with a shared Zod schema.
 * Cookies are always sent: sessions live in httpOnly cookies (CLAUDE.md §6).
 */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  { body, headers, ...init }: RequestOptions = {},
): Promise<z.infer<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    throw parsed.success
      ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(response.status, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
  }
  return schema.parse(data);
}
