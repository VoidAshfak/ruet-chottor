'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHydrated } from '@/lib/use-hydrated';
import { authApi } from '../api';

export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

/**
 * Who is logged in. `user` is null for visitors. Like useFeatures, it reports "loading" until
 * hydration so the server and first client render match.
 */
export function useSession({ enabled = true }: { enabled?: boolean } = {}) {
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: authApi.session,
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
  return {
    user: hydrated ? (query.data ?? null) : null,
    isPending: !hydrated || (enabled && query.isPending),
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // Anything cached for the previous user must not leak to the next one.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'features' });
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  });
}
