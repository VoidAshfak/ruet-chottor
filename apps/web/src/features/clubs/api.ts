import {
  clubDetailSchema,
  type ClubCategory,
  clubMemberPageSchema,
  clubPageSchema,
  clubSummarySchema,
  type CreateClubRequest,
  type MembershipState,
  type UpdateClubRequest,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
};
const noContent = z.undefined();

export const clubsApi = {
  list: (params: { q?: string; category?: ClubCategory; cursor?: string }) =>
    apiRequest(
      `/clubs${query({ q: params.q, category: params.category, cursor: params.cursor })}`,
      clubPageSchema,
    ),
  mine: () => apiRequest('/clubs/mine', z.array(clubSummarySchema)),
  club: (slug: string) => apiRequest(`/clubs/${encodeURIComponent(slug)}`, clubDetailSchema),
  create: (body: CreateClubRequest) =>
    apiRequest('/clubs', clubDetailSchema, { method: 'POST', body }),
  update: (id: string, body: UpdateClubRequest) =>
    apiRequest(`/clubs/${id}`, clubDetailSchema, { method: 'PATCH', body }),
  setManagers: (id: string, userIds: string[]) =>
    apiRequest(`/clubs/${id}/managers`, clubDetailSchema, { method: 'PUT', body: { userIds } }),
  join: (id: string) => apiRequest(`/clubs/${id}/membership`, clubDetailSchema, { method: 'POST' }),
  leave: (id: string) => apiRequest(`/clubs/${id}/membership`, noContent, { method: 'DELETE' }),
  members: (id: string, state: MembershipState, cursor?: string) =>
    apiRequest(`/clubs/${id}/members${query({ state, cursor })}`, clubMemberPageSchema),
  approve: (id: string, userId: string) =>
    apiRequest(`/clubs/${id}/members/${userId}/approve`, noContent, { method: 'POST' }),
  removeMember: (id: string, userId: string) =>
    apiRequest(`/clubs/${id}/members/${userId}`, noContent, { method: 'DELETE' }),
};
