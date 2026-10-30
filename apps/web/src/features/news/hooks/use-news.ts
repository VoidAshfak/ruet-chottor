'use client';

import type { NewsCategory, NewsPost, NewsPostInputValues } from '@ruet-chottor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { newsApi } from '../api';

export const newsKeys = {
  all: ['news'] as const,
  feed: (category?: NewsCategory) => ['news', 'feed', category ?? 'all'] as const,
  mine: ['news', 'mine'] as const,
  review: ['news', 'review'] as const,
  post: (id: string) => ['news', 'post', id] as const,
};

const pages = { initialPageParam: undefined as string | undefined };

export function useNewsFeed(category: NewsCategory | undefined, { enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: newsKeys.feed(category),
    queryFn: ({ pageParam }) => newsApi.feed(category, pageParam),
    ...pages,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
}

export function useMyNews({ enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: newsKeys.mine,
    queryFn: ({ pageParam }) => newsApi.mine(pageParam),
    ...pages,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
}

export function useNewsReviewQueue() {
  return useInfiniteQuery({
    queryKey: newsKeys.review,
    queryFn: ({ pageParam }) => newsApi.reviewQueue(pageParam),
    ...pages,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useNewsPost(id: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: newsKeys.post(id),
    queryFn: () => newsApi.post(id),
    enabled,
    retry: false,
  });
}

/** Any change can move posts between the feed, "My posts" and the review queue: refresh them all. */
function useRefreshNews() {
  const queryClient = useQueryClient();
  return (post?: NewsPost) => {
    if (post) queryClient.setQueryData(newsKeys.post(post.id), post);
    void queryClient.invalidateQueries({ queryKey: newsKeys.all });
  };
}

export function useSaveNews(id?: string) {
  const refresh = useRefreshNews();
  return useMutation({
    mutationFn: (body: NewsPostInputValues) =>
      id ? newsApi.update(id, body) : newsApi.create(body),
    onSuccess: refresh,
  });
}

export function useDeleteNews() {
  const refresh = useRefreshNews();
  return useMutation({ mutationFn: newsApi.remove, onSuccess: () => refresh() });
}

export function useNewsDecision() {
  const refresh = useRefreshNews();
  const queryClient = useQueryClient();
  const done = (post: NewsPost) => {
    refresh(post);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'log'] });
  };
  return {
    approve: useMutation({ mutationFn: newsApi.approve, onSuccess: done }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => newsApi.reject(id, reason),
      onSuccess: done,
    }),
  };
}
