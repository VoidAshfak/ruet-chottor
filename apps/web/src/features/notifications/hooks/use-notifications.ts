'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
};

export function useNotifications({ enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
}

export function useUnreadCount({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationsApi.unreadCount,
    enabled,
    // The socket pushes changes; this only covers a missed event.
    staleTime: 60 * 1000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
