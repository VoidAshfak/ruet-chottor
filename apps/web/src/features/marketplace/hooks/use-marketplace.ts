'use client';

import type { Listing, ListingInputValues, ListingState } from '@ruet-chottor/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type BrowseFilters, marketplaceApi } from '../api';

const pages = {
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (page: { nextCursor: string | null }) => page.nextCursor ?? undefined,
};

export function useListings(filters: BrowseFilters) {
  return useInfiniteQuery({
    queryKey: ['marketplace', 'browse', filters],
    queryFn: ({ pageParam }) => marketplaceApi.browse(filters, pageParam),
    ...pages,
    staleTime: 30 * 1000,
  });
}

export function useMyListings() {
  return useInfiniteQuery({
    queryKey: ['marketplace', 'mine'],
    queryFn: ({ pageParam }) => marketplaceApi.mine(pageParam),
    ...pages,
  });
}

export function useListing(id: string) {
  return useQuery({
    queryKey: ['marketplace', 'listing', id],
    queryFn: () => marketplaceApi.listing(id),
    retry: false,
  });
}

/** A change can move a listing in or out of results: keep the fresh copy, refresh the lists. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (listing?: Listing) => {
    if (listing) queryClient.setQueryData(['marketplace', 'listing', listing.id], listing);
    void queryClient.invalidateQueries({ queryKey: ['marketplace'] });
  };
}

export function useSaveListing(id?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: ListingInputValues) =>
      id ? marketplaceApi.update(id, body) : marketplaceApi.create(body),
    onSuccess: refresh,
  });
}

export function useListingActions(id: string) {
  const refresh = useRefresh();
  return {
    setState: useMutation({
      mutationFn: (state: ListingState) => marketplaceApi.setState(id, state),
      onSuccess: refresh,
    }),
    renew: useMutation({ mutationFn: () => marketplaceApi.renew(id), onSuccess: refresh }),
    remove: useMutation({
      mutationFn: () => marketplaceApi.remove(id),
      onSuccess: () => refresh(),
    }),
  };
}
