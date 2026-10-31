import {
  type ClassRepApplyRequest,
  classRepRequestSchema,
  classRepReviewPageSchema,
  dismissedGuidesResponseSchema,
  myClassRepSchema,
  myProfileSchema,
  publicProfileSchema,
  type UpdateMyProfileRequest,
} from '@ruet-chottor/shared';
import { apiRequest } from '@/lib/api-client';

export type ClassRepListStatus = 'pending' | 'approved';

export const usersApi = {
  me: () => apiRequest('/users/me', myProfileSchema),

  updateMe: (body: UpdateMyProfileRequest) =>
    apiRequest('/users/me', myProfileSchema, { method: 'PATCH', body }),

  profile: (id: string) => apiRequest(`/users/${encodeURIComponent(id)}`, publicProfileSchema),

  dismissGuide: (moduleKey: string) =>
    apiRequest('/users/me/guides', dismissedGuidesResponseSchema, {
      method: 'PATCH',
      body: { moduleKey },
    }),

  resetGuides: () =>
    apiRequest('/users/me/guides', dismissedGuidesResponseSchema, { method: 'DELETE' }),

  myClassRep: () => apiRequest('/users/me/class-rep', myClassRepSchema),

  applyClassRep: (body: ClassRepApplyRequest) =>
    apiRequest('/users/me/class-rep', myClassRepSchema, { method: 'POST', body }),

  withdrawClassRep: () => apiRequest('/users/me/class-rep', myClassRepSchema, { method: 'DELETE' }),

  classReps: (status: ClassRepListStatus, cursor?: string) => {
    const search = new URLSearchParams({ status });
    if (cursor) search.set('cursor', cursor);
    return apiRequest(`/users/class-reps?${search}`, classRepReviewPageSchema);
  },

  approveClassRep: (id: string) =>
    apiRequest(`/users/class-reps/${encodeURIComponent(id)}/approve`, classRepRequestSchema, {
      method: 'POST',
      body: {},
    }),

  rejectClassRep: (id: string, reason: string) =>
    apiRequest(`/users/class-reps/${encodeURIComponent(id)}/reject`, classRepRequestSchema, {
      method: 'POST',
      body: { reason },
    }),

  revokeClassRep: (id: string, reason: string) =>
    apiRequest(`/users/class-reps/${encodeURIComponent(id)}/revoke`, classRepRequestSchema, {
      method: 'POST',
      body: { reason },
    }),
};
