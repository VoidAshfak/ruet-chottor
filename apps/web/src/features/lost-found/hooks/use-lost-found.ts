'use client';

import type { LostFoundInputValues, LostFoundItem, LostFoundState } from '@ruet-chottor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type BoardFilters, lostFoundApi } from '../api';

const pages = {
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (page: { nextCursor: string | null }) => page.nextCursor ?? undefined,
};

export function useBoard(filters: BoardFilters) {
  return useInfiniteQuery({
    queryKey: ['lost-found', 'board', filters],
    queryFn: ({ pageParam }) => lostFoundApi.board(filters, pageParam),
    ...pages,
    staleTime: 30 * 1000,
  });
}

export function useMyItems() {
  return useInfiniteQuery({
    queryKey: ['lost-found', 'mine'],
    queryFn: ({ pageParam }) => lostFoundApi.mine(pageParam),
    ...pages,
  });
}

export function useItem(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['lost-found', 'item', id],
    queryFn: () => lostFoundApi.item(id),
    enabled,
    retry: false,
  });
}

/** A change can move a post on or off the board: keep the fresh copy, refresh the lists. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (item?: LostFoundItem) => {
    if (item) queryClient.setQueryData(['lost-found', 'item', item.id], item);
    void queryClient.invalidateQueries({ queryKey: ['lost-found'] });
  };
}

export function useSaveItem(id?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: LostFoundInputValues) =>
      id ? lostFoundApi.update(id, body) : lostFoundApi.create(body),
    onSuccess: refresh,
  });
}

export function useItemActions(id: string) {
  const refresh = useRefresh();
  return {
    setState: useMutation({
      mutationFn: (state: LostFoundState) => lostFoundApi.setState(id, state),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: () => lostFoundApi.remove(id), onSuccess: () => refresh() }),
  };
}
