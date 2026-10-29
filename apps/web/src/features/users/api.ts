import {
  dismissedGuidesResponseSchema,
  myProfileSchema,
  publicProfileSchema,
  type UpdateMyProfileRequest,
} from '@ruet-chottor/shared';
import { apiRequest } from '@/lib/api-client';

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
};
