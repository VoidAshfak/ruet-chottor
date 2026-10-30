import {
  newsPageSchema,
  newsPostSchema,
  type NewsCategory,
  type NewsPostInputValues,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const newsApi = {
  feed: (category: NewsCategory | undefined, cursor?: string) =>
    apiRequest(`/news${query({ category, cursor })}`, newsPageSchema),
  mine: (cursor?: string) => apiRequest(`/news/mine${query({ cursor })}`, newsPageSchema),
  reviewQueue: (cursor?: string) => apiRequest(`/news/review${query({ cursor })}`, newsPageSchema),
  post: (id: string) => apiRequest(`/news/${id}`, newsPostSchema),
  create: (body: NewsPostInputValues) =>
    apiRequest('/news', newsPostSchema, { method: 'POST', body }),
  update: (id: string, body: NewsPostInputValues) =>
    apiRequest(`/news/${id}`, newsPostSchema, { method: 'PATCH', body }),
  remove: (id: string) => apiRequest(`/news/${id}`, z.undefined(), { method: 'DELETE' }),
  approve: (id: string) =>
    apiRequest(`/news/${id}/approve`, newsPostSchema, { method: 'POST', body: {} }),
  reject: (id: string, reason: string) =>
    apiRequest(`/news/${id}/reject`, newsPostSchema, { method: 'POST', body: { reason } }),
};
