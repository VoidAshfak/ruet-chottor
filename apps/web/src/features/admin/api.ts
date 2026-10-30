import {
  adminUserDetailSchema,
  adminUserPageSchema,
  type ChangeRoleRequest,
  moderationLogPageSchema,
  type ReasonRequest,
  type SuspendRequest,
} from '@ruet-chottor/shared';
import { apiRequest } from '@/lib/api-client';

function toQuery(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

const user = (id: string) => `/admin/users/${encodeURIComponent(id)}`;

export const adminApi = {
  users: (query: { q?: string; role?: string; status?: string; cursor?: string }) =>
    apiRequest(`/admin/users?${toQuery(query)}`, adminUserPageSchema),

  user: (id: string) => apiRequest(user(id), adminUserDetailSchema),

  warn: (id: string, body: ReasonRequest) =>
    apiRequest(`${user(id)}/warn`, adminUserDetailSchema, { method: 'POST', body }),

  suspend: (id: string, body: SuspendRequest) =>
    apiRequest(`${user(id)}/suspend`, adminUserDetailSchema, { method: 'POST', body }),

  ban: (id: string, body: ReasonRequest) =>
    apiRequest(`${user(id)}/ban`, adminUserDetailSchema, { method: 'POST', body }),

  reinstate: (id: string, body: ReasonRequest) =>
    apiRequest(`${user(id)}/reinstate`, adminUserDetailSchema, { method: 'POST', body }),

  changeRole: (id: string, body: ChangeRoleRequest) =>
    apiRequest(`${user(id)}/role`, adminUserDetailSchema, { method: 'PATCH', body }),

  log: (cursor?: string) =>
    apiRequest(`/admin/log?${toQuery({ cursor })}`, moderationLogPageSchema),
};
