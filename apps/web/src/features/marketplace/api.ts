import {
  type ListingCategory,
  type ListingInputValues,
  listingPageSchema,
  listingSchema,
  type ListingSort,
  type ListingState,
} from '@ruet-chottor/shared';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';

export type BrowseFilters = {
  category?: ListingCategory;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: ListingSort;
};

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const marketplaceApi = {
  browse: (filters: BrowseFilters, cursor?: string) =>
    apiRequest(`/marketplace/listings${query({ ...filters, cursor })}`, listingPageSchema),
  mine: (cursor?: string) =>
    apiRequest(`/marketplace/listings/mine${query({ cursor })}`, listingPageSchema),
  listing: (id: string) => apiRequest(`/marketplace/listings/${id}`, listingSchema),
  create: (body: ListingInputValues) =>
    apiRequest('/marketplace/listings', listingSchema, { method: 'POST', body }),
  update: (id: string, body: ListingInputValues) =>
    apiRequest(`/marketplace/listings/${id}`, listingSchema, { method: 'PATCH', body }),
  setState: (id: string, state: ListingState) =>
    apiRequest(`/marketplace/listings/${id}/state`, listingSchema, {
      method: 'POST',
      body: { state },
    }),
  renew: (id: string) =>
    apiRequest(`/marketplace/listings/${id}/renew`, listingSchema, { method: 'POST' }),
  remove: (id: string) =>
    apiRequest(`/marketplace/listings/${id}`, z.undefined(), { method: 'DELETE' }),
};
