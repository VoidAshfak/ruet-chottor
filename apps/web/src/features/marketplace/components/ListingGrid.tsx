'use client';

import type { ListingPage } from '@ruet-chottor/shared';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { ListingCard } from './ListingCard';

/** A paged grid of listings with loading, error and empty states. */
export function ListingGrid({
  query,
  empty,
  showState = false,
}: {
  query: UseInfiniteQueryResult<InfiniteData<ListingPage>, Error>;
  empty: string;
  showState?: boolean;
}) {
  const listings = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (query.isPending) {
    return (
      <ul
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
        aria-label={help.browse.loading}
      >
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="aspect-[3/4] animate-pulse rounded-lg border bg-muted" />
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="text-destructive">{query.error.message || help.browse.error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>
          {help.browse.retry}
        </Button>
      </div>
    );
  }
  if (listings.length === 0) {
    return <p className="rounded-lg border p-6 text-center text-muted-foreground">{empty}</p>;
  }
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} showState={showState} />
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {help.browse.loadMore}
          </Button>
        </div>
      ) : null}
    </>
  );
}
