import {
  notificationPageSchema,
  notificationSchema,
  unreadCountSchema,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

const noContent = z.undefined();

export const notificationsApi = {
  list: (cursor?: string) =>
    apiRequest(
      `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      notificationPageSchema,
    ),
  unreadCount: () => apiRequest('/notifications/unread-count', unreadCountSchema),
  markRead: (id: string) =>
    apiRequest(`/notifications/${id}/read`, notificationSchema, { method: 'POST' }),
  markAllRead: () => apiRequest('/notifications/read-all', noContent, { method: 'POST' }),
};
