'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { directoryApi } from '../api';

export type DirectoryFilters = { q: string; department: string; series: string; role: string };

export function useDirectory(filters: DirectoryFilters, { enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: ['directory', filters],
    queryFn: ({ pageParam }) => directoryApi.search({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
    staleTime: 30 * 1000,
  });
}
