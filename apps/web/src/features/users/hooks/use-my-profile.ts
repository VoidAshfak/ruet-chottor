'use client';

import type { MyProfile } from '@ruet-chottor/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearLocalGuideDismissals } from '@/components/guide/use-guide-dismissal';
import { usersApi } from '../api';

export const MY_PROFILE_QUERY_KEY = ['users', 'me'] as const;

export function useMyProfile({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: usersApi.me,
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.updateMe,
    onSuccess: (profile) => queryClient.setQueryData(MY_PROFILE_QUERY_KEY, profile),
  });
}

export function useDismissGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.dismissGuide,
    onMutate: (moduleKey) => setDismissed(queryClient, (keys) => [...keys, moduleKey]),
    onSuccess: ({ dismissedGuides }) => setDismissed(queryClient, () => dismissedGuides),
  });
}

export function useResetGuides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.resetGuides,
    onSuccess: ({ dismissedGuides }) => {
      clearLocalGuideDismissals();
      setDismissed(queryClient, () => dismissedGuides);
    },
  });
}

function setDismissed(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (keys: string[]) => string[],
) {
  queryClient.setQueryData<MyProfile>(MY_PROFILE_QUERY_KEY, (profile) =>
    profile ? { ...profile, dismissedGuides: update(profile.dismissedGuides) } : profile,
  );
}
