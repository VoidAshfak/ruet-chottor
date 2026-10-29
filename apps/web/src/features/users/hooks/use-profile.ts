'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api-client';
import { usersApi } from '../api';

/** Another member's public profile. */
export function useProfile(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['users', 'profile', id],
    queryFn: () => usersApi.profile(id),
    enabled,
    staleTime: 60 * 1000,
    // A missing member will not appear on retry.
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
}
