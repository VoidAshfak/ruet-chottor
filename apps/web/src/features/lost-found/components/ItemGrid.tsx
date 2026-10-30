'use client';

import type { LostFoundPage } from '@ruet-chottor/shared';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { EmptyState } from '@/components/art/EmptyState';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { ItemCard } from './ItemCard';

/** A paged grid of posts with loading, error and empty states. */
export function ItemGrid({
  query,
  empty,
  showState = false,
}: {
  query: UseInfiniteQueryResult<InfiniteData<LostFoundPage>, Error>;
  empty: string;
  showState?: boolean;
}) {
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (query.isPending) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={help.board.loading}>
        {[0, 1, 2].map((row) => (
          <li key={row} className="h-56 animate-pulse rounded-lg border bg-muted" />
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="text-destructive">{query.error.message || help.board.error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>
          {help.board.retry}
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} showState={showState} />
        ))}
      </ul>
      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {help.board.loadMore}
          </Button>
        </div>
      ) : null}
    </>
  );
}
