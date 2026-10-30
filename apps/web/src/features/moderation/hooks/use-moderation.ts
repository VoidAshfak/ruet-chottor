'use client';

import {
  type ContentAction,
  type CreateReportRequestInput,
  MODERATION_LIMITS,
  type ModeratableContentType,
  type ReportStatus,
} from '@ruet-chottor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatures } from '@/lib/use-features';
import { moderationApi } from '../api';

/** Reporting needs the moderation module, which also needs admin (it writes the moderation log). */
export function useModerationEnabled(): boolean {
  const modules = useFeatures().data?.modules ?? [];
  return modules.includes('moderation') && modules.includes('admin');
}

/** Which of these items the viewer already reported ("You reported this"). */
export function useReportedIds(contentType: ModeratableContentType, ids: string[]) {
  const enabled = useModerationEnabled();
  const batch = ids.slice(-MODERATION_LIMITS.myReportsMaxIds);
  const query = useQuery({
    queryKey: ['moderation', 'mine', contentType, batch],
    queryFn: () => moderationApi.mine(contentType, batch),
    enabled: enabled && batch.length > 0,
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
  });
  return new Set(query.data?.reportedIds ?? []);
}

export function useReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReportRequestInput) => moderationApi.report(body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['moderation', 'mine'] }),
  });
}

export function useModerationQueue(status: ReportStatus) {
  return useInfiniteQuery({
    queryKey: ['moderation', 'queue', status],
    queryFn: ({ pageParam }) => moderationApi.queue({ status, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useModerationItem(contentType: ModeratableContentType, contentId: string) {
  return useQuery({
    queryKey: ['moderation', 'item', contentType, contentId],
    queryFn: () => moderationApi.item(contentType, contentId),
    retry: false,
  });
}

export function useContentAction(contentType: ModeratableContentType, contentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }: { action: ContentAction; reason: string }) =>
      moderationApi.act(contentType, contentId, action, reason),
    onSuccess: (detail) => {
      queryClient.setQueryData(['moderation', 'item', contentType, contentId], detail);
      void queryClient.invalidateQueries({ queryKey: ['moderation', 'queue'] });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
