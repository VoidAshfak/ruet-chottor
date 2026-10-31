import {
  eventAttendeesSchema,
  type EventCategory,
  type EventInputValues,
  eventListSchema,
  eventReviewPageSchema,
  eventSchema,
} from '@ruet-chottor/shared';
import { apiRequest } from '@/lib/api-client';

export type EventRange = { from: string; to: string; clubId?: string; category?: EventCategory };

export const eventsApi = {
  range: ({ from, to, clubId, category }: EventRange) => {
    const params = new URLSearchParams({ from, to });
    if (clubId) params.set('clubId', clubId);
    if (category) params.set('category', category);
    return apiRequest(`/events?${params.toString()}`, eventListSchema);
  },
  event: (id: string) => apiRequest(`/events/${id}`, eventSchema),
  create: (body: EventInputValues) => apiRequest('/events', eventSchema, { method: 'POST', body }),
  update: (id: string, body: EventInputValues) =>
    apiRequest(`/events/${id}`, eventSchema, { method: 'PATCH', body }),
  cancel: (id: string) => apiRequest(`/events/${id}/cancel`, eventSchema, { method: 'POST' }),
  going: (id: string) => apiRequest(`/events/${id}/rsvp`, eventSchema, { method: 'POST' }),
  notGoing: (id: string) => apiRequest(`/events/${id}/rsvp`, eventSchema, { method: 'DELETE' }),
  attendees: (id: string) => apiRequest(`/events/${id}/attendees`, eventAttendeesSchema),
  reviewQueue: (cursor?: string) =>
    apiRequest(
      `/events/review${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      eventReviewPageSchema,
    ),
  approve: (id: string) =>
    apiRequest(`/events/${id}/approve`, eventSchema, { method: 'POST', body: {} }),
  reject: (id: string, reason: string) =>
    apiRequest(`/events/${id}/reject`, eventSchema, { method: 'POST', body: { reason } }),
};
