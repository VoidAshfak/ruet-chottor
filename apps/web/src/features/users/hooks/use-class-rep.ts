'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ClassRepListStatus, usersApi } from '../api';
import { MY_PROFILE_QUERY_KEY } from './use-my-profile';

export const classRepKeys = {
  mine: ['users', 'class-rep', 'mine'] as const,
  list: (status: ClassRepListStatus) => ['users', 'class-rep', 'list', status] as const,
};

export function useMyClassRep({ enabled }: { enabled: boolean }) {
  return useQuery({ queryKey: classRepKeys.mine, queryFn: usersApi.myClassRep, enabled });
}

/** Asking, withdrawing and stepping down all change the badge on the profile too. */
export function useMyClassRepActions() {
  const queryClient = useQueryClient();
  const done = (result: Awaited<ReturnType<typeof usersApi.myClassRep>>) => {
    queryClient.setQueryData(classRepKeys.mine, result);
    void queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY });
  };
  return {
    apply: useMutation({ mutationFn: usersApi.applyClassRep, onSuccess: done }),
    withdraw: useMutation({ mutationFn: usersApi.withdrawClassRep, onSuccess: done }),
  };
}

export function useClassRepList(status: ClassRepListStatus) {
  return useInfiniteQuery({
    queryKey: classRepKeys.list(status),
    queryFn: ({ pageParam }) => usersApi.classReps(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

/** Staff decisions move requests between the lists and add to the moderation log. */
export function useClassRepDecision() {
  const queryClient = useQueryClient();
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ['users', 'class-rep', 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'log'] });
  };
  const withReason =
    (call: (id: string, reason: string) => Promise<unknown>) =>
    ({ id, reason }: { id: string; reason: string }) =>
      call(id, reason);
  return {
    approve: useMutation({ mutationFn: usersApi.approveClassRep, onSuccess: done }),
    reject: useMutation({ mutationFn: withReason(usersApi.rejectClassRep), onSuccess: done }),
    revoke: useMutation({ mutationFn: withReason(usersApi.revokeClassRep), onSuccess: done }),
  };
}
