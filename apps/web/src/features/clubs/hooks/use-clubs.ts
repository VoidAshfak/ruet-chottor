'use client';

import type {
  ClubCategory,
  CreateClubRequest,
  MembershipState,
  UpdateClubRequest,
} from '@ruet-chottor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFeatures } from '@/lib/use-features';
import { clubsApi } from '../api';

const all = ['clubs'] as const;

export function useClubs(filters: { q: string; category?: ClubCategory }) {
  return useInfiniteQuery({
    queryKey: ['clubs', 'list', filters],
    queryFn: ({ pageParam }) => clubsApi.list({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export function useMyClubs({ enabled }: { enabled: boolean }) {
  return useQuery({ queryKey: ['clubs', 'mine'], queryFn: clubsApi.mine, enabled });
}

/** Clubs the viewer manages, for "post as club" in News. Empty when clubs are switched off. */
export function useManagedClubs({ enabled }: { enabled: boolean }) {
  const clubsOn = useFeatures().data?.modules.includes('clubs') ?? false;
  const mine = useMyClubs({ enabled: enabled && clubsOn });
  return (mine.data ?? []).filter(
    (club) => club.myMembership?.role === 'manager' && club.myMembership.state === 'active',
  );
}

export function useClub(slug: string) {
  return useQuery({
    queryKey: ['clubs', 'club', slug],
    queryFn: () => clubsApi.club(slug),
    retry: false,
  });
}

export function useClubMembers(
  id: string,
  state: MembershipState,
  { enabled }: { enabled: boolean },
) {
  return useInfiniteQuery({
    queryKey: ['clubs', 'members', id, state],
    queryFn: ({ pageParam }) => clubsApi.members(id, state, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: all });
}

export function useClubActions(id: string) {
  const refresh = useRefresh();
  return {
    join: useMutation({ mutationFn: () => clubsApi.join(id), onSuccess: refresh }),
    leave: useMutation({ mutationFn: () => clubsApi.leave(id), onSuccess: refresh }),
    update: useMutation({
      mutationFn: (body: UpdateClubRequest) => clubsApi.update(id, body),
      onSuccess: refresh,
    }),
    approve: useMutation({
      mutationFn: (userId: string) => clubsApi.approve(id, userId),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => clubsApi.removeMember(id, userId),
      onSuccess: refresh,
    }),
    setManagers: useMutation({
      mutationFn: (userIds: string[]) => clubsApi.setManagers(id, userIds),
      onSuccess: refresh,
    }),
  };
}

export function useCreateClub() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: CreateClubRequest) => clubsApi.create(body),
    onSuccess: refresh,
  });
}
