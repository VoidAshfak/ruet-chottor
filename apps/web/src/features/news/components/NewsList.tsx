'use client';

import type { NewsPage } from '@ruet-chottor/shared';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { NewsCard } from './NewsCard';

type NewsListProps = {
  query: UseInfiniteQueryResult<InfiniteData<NewsPage>, Error>;
  empty: string;
  showReview?: boolean;
  /** Extra controls under each post, e.g. Approve/Reject for staff. */
  renderActions?: (id: string) => ReactNode;
};

/** A paged list of posts with loading, error and empty states. */
export function NewsList({ query, empty, showReview, renderActions }: NewsListProps) {
  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <ul className="grid gap-4" aria-label={help.feed.loading}>
        {[0, 1, 2].map((row) => (
          <li key={row} className="h-40 animate-pulse rounded-lg border bg-muted" />
        ))}
      </ul>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="text-destructive">{query.error.message || help.feed.error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>
          {help.feed.retry}
        </Button>
      </div>
    );
  }
  if (posts.length === 0) {
    return <p className="rounded-lg border p-6 text-center text-muted-foreground">{empty}</p>;
  }

  return (
    <>
      <ul className="grid gap-4">
        {posts.map((post) =>
          renderActions ? (
            <li key={post.id} className="grid gap-2">
              <ul>
                <NewsCard post={post} showReview={showReview} />
              </ul>
              {renderActions(post.id)}
            </li>
          ) : (
            <NewsCard key={post.id} post={post} showReview={showReview} />
          ),
        )}
      </ul>
      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {help.feed.loadMore}
          </Button>
        </div>
      ) : null}
    </>
  );
}
