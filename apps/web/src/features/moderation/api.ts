import {
  type ContentAction,
  type CreateReportRequestInput,
  type ModeratableContentType,
  moderationItemDetailSchema,
  moderationQueuePageSchema,
  type ModerationQueueQueryInput,
  myReportsResponseSchema,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

export const moderationApi = {
  report: (body: CreateReportRequestInput) =>
    apiRequest('/moderation/reports', z.undefined(), { method: 'POST', body }),
  mine: (contentType: ModeratableContentType, ids: string[]) =>
    apiRequest(
      `/moderation/reports/mine?contentType=${contentType}&ids=${ids.join(',')}`,
      myReportsResponseSchema,
    ),
  queue: (query: ModerationQueueQueryInput) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    return apiRequest(`/moderation/queue?${params.toString()}`, moderationQueuePageSchema);
  },
  item: (contentType: ModeratableContentType, contentId: string) =>
    apiRequest(`/moderation/items/${contentType}/${contentId}`, moderationItemDetailSchema),
  act: (
    contentType: ModeratableContentType,
    contentId: string,
    action: ContentAction,
    reason: string,
  ) =>
    apiRequest(
      `/moderation/items/${contentType}/${contentId}/${action}`,
      moderationItemDetailSchema,
      {
        method: 'POST',
        body: { reason },
      },
    ),
};
