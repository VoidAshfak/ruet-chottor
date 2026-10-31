'use client';

import type { CampusEvent, EventInputValues } from '@ruet-chottor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type EventRange, eventsApi } from '../api';

export function useEventRange(range: EventRange) {
  return useQuery({
    queryKey: ['events', 'range', range],
    queryFn: () => eventsApi.range(range),
    staleTime: 30 * 1000,
    placeholderData: (previous) => previous,
  });
}

export function useEvent(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['events', 'event', id],
    queryFn: () => eventsApi.event(id),
    enabled,
    retry: false,
  });
}

export function useAttendees(id: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: ['events', 'attendees', id],
    queryFn: () => eventsApi.attendees(id),
    enabled,
  });
}

/** Every change can move an event on the calendar: keep the fresh copy, refresh the rest. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (event: CampusEvent) => {
    queryClient.setQueryData(['events', 'event', event.id], event);
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };
}

export function useSaveEvent(id?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: EventInputValues) =>
      id ? eventsApi.update(id, body) : eventsApi.create(body),
    onSuccess: refresh,
  });
}

export function useEventActions(id: string) {
  const refresh = useRefresh();
  return {
    going: useMutation({ mutationFn: () => eventsApi.going(id), onSuccess: refresh }),
    notGoing: useMutation({ mutationFn: () => eventsApi.notGoing(id), onSuccess: refresh }),
    cancel: useMutation({ mutationFn: () => eventsApi.cancel(id), onSuccess: refresh }),
  };
}

export function useEventReviewQueue() {
  return useInfiniteQuery({
    queryKey: ['events', 'review'],
    queryFn: ({ pageParam }) => eventsApi.reviewQueue(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** Staff decisions move events onto the calendar and into the moderation log. */
export function useEventDecision() {
  const refresh = useRefresh();
  const queryClient = useQueryClient();
  const done = (event: CampusEvent) => {
    refresh(event);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'log'] });
  };
  return {
    approve: useMutation({ mutationFn: eventsApi.approve, onSuccess: done }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => eventsApi.reject(id, reason),
      onSuccess: done,
    }),
  };
}
