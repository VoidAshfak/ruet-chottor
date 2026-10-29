'use client';

import { featuresResponseSchema } from '@ruet-chottor/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api-client';
import { useHydrated } from './use-hydrated';

/** Modules switched on in the API (FEATURE_<MODULE> flags). Drives navigation. */
export function useFeatures() {
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: ['features'],
    queryFn: () => apiRequest('/features', featuresResponseSchema),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // The server always renders "loading", but the browser cache may already hold the answer.
  // Report "loading" until hydration finishes so both renders match.
  return {
    data: hydrated ? query.data : undefined,
    isPending: !hydrated || query.isPending,
    isError: hydrated && query.isError,
  };
}
