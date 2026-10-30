'use client';

import type { BusNoticeInputValues, BusRouteInputValues } from '@ruet-chottor/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { busApi } from '../api';

export function useRoutes({ all = false }: { all?: boolean } = {}) {
  return useQuery({
    queryKey: ['bus', 'routes', all],
    queryFn: () => busApi.routes(all),
    // The timetable changes rarely.
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoute(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['bus', 'route', id],
    queryFn: () => busApi.route(id),
    enabled,
    retry: false,
  });
}

export function useNotices({ all = false }: { all?: boolean } = {}) {
  return useQuery({
    queryKey: ['bus', 'notices', all],
    queryFn: () => busApi.notices(all),
    staleTime: 5 * 60 * 1000,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['bus'] });
}

export function useSaveRoute(id?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: BusRouteInputValues) =>
      id ? busApi.saveRoute(id, body) : busApi.createRoute(body),
    onSuccess: refresh,
  });
}

export function useDeleteRoute() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: busApi.deleteRoute, onSuccess: refresh });
}

export function useNoticeActions() {
  const refresh = useRefresh();
  return {
    create: useMutation({
      mutationFn: (body: BusNoticeInputValues) => busApi.createNotice(body),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: busApi.deleteNotice, onSuccess: refresh }),
  };
}
