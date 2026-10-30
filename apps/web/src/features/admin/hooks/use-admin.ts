'use client';

import { type AdminUserDetail, type Role, STAFF_ROLES } from '@ruet-chottor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { adminApi } from '../api';

/** Hides staff UI from everyone else. The API checks roles itself; this is not the security boundary. */
export function useStaff() {
  const session = useSession();
  const role = session.user?.role;
  return {
    ...session,
    isStaff: role !== undefined && (STAFF_ROLES as readonly Role[]).includes(role),
    isAdmin: role === 'admin',
  };
}

export type MemberFilters = { q: string; role: string; status: string };

export function useAdminUsers(filters: MemberFilters, { enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: ({ pageParam }) => adminApi.users({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
}

export function useAdminUser(id: string, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => adminApi.user(id),
    enabled,
    retry: false,
  });
}

export function useModerationLog({ enabled }: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: ['admin', 'log'],
    queryFn: ({ pageParam }) => adminApi.log(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
}

export type MemberAction =
  | { kind: 'warn' | 'ban' | 'reinstate'; reason: string }
  | { kind: 'suspend'; reason: string; days: number }
  | { kind: 'role'; reason: string; role: Role };

export function useMemberAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: MemberAction): Promise<AdminUserDetail> => {
      switch (action.kind) {
        case 'warn':
          return adminApi.warn(id, { reason: action.reason });
        case 'ban':
          return adminApi.ban(id, { reason: action.reason });
        case 'reinstate':
          return adminApi.reinstate(id, { reason: action.reason });
        case 'suspend':
          return adminApi.suspend(id, { reason: action.reason, days: action.days });
        case 'role':
          return adminApi.changeRole(id, { reason: action.reason, role: action.role });
      }
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(['admin', 'user', id], detail);
      // Lists and the log now show stale data.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'log'] });
    },
  });
}
