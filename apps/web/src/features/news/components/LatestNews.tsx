'use client';

import { formatDateTime } from '@ruet-chottor/shared';
import Link from 'next/link';
import { help } from '../help';
import { useNewsFeed } from '../hooks/use-news';

const COUNT = 3;

/** The three newest published posts, for the home page. Renders nothing while empty. */
export function LatestNews() {
  const feed = useNewsFeed(undefined, undefined, { enabled: true });
  const posts = feed.data?.pages[0]?.items.slice(0, COUNT) ?? [];

  if (feed.isPending) {
    return <div className="h-32 animate-pulse rounded-xl border bg-muted" aria-hidden />;
  }
  if (feed.isError || posts.length === 0) return null;

  return (
    <section aria-labelledby="latest-news" className="rounded-xl border p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="latest-news" className="font-semibold">
          {help.latest.title}
        </h2>
        <Link href="/news" className="text-sm text-primary hover:underline">
          {help.latest.all}
        </Link>
      </div>
      <ul className="grid gap-3">
        {posts.map((post) => (
          <li key={post.id} className="grid gap-0.5">
            <Link href={`/news/${post.id}`} className="font-medium break-words hover:underline">
              {post.title}
            </Link>
            <span className="text-xs text-muted-foreground">
              {help.categories[post.category]} ·{' '}
              {post.club?.name ?? post.author?.name ?? help.feed.unknownAuthor} ·{' '}
              {formatDateTime(post.publishedAt ?? post.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
