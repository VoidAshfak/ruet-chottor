import {
  type CampusPlace,
  type LostFoundCategory,
  lostFoundItemSchema,
  type LostFoundInputValues,
  type LostFoundKind,
  lostFoundPageSchema,
  type LostFoundState,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

export type BoardFilters = {
  kind?: LostFoundKind;
  category?: LostFoundCategory;
  place?: CampusPlace;
  q?: string;
};

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const lostFoundApi = {
  board: (filters: BoardFilters, cursor?: string) =>
    apiRequest(`/lost-found/items${query({ ...filters, cursor })}`, lostFoundPageSchema),
  mine: (cursor?: string) =>
    apiRequest(`/lost-found/items/mine${query({ cursor })}`, lostFoundPageSchema),
  item: (id: string) => apiRequest(`/lost-found/items/${id}`, lostFoundItemSchema),
  create: (body: LostFoundInputValues) =>
    apiRequest('/lost-found/items', lostFoundItemSchema, { method: 'POST', body }),
  update: (id: string, body: LostFoundInputValues) =>
    apiRequest(`/lost-found/items/${id}`, lostFoundItemSchema, { method: 'PATCH', body }),
  setState: (id: string, state: LostFoundState) =>
    apiRequest(`/lost-found/items/${id}/state`, lostFoundItemSchema, {
      method: 'POST',
      body: { state },
    }),
  remove: (id: string) =>
    apiRequest(`/lost-found/items/${id}`, z.undefined(), { method: 'DELETE' }),
};
