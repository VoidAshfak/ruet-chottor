'use client';

import { NEWS_CATEGORIES, type NewsCategory } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { useNewsFeed } from '../hooks/use-news';
import { LoginGate } from './LoginGate';
import { NewsList } from './NewsList';

function Feed() {
  const [category, setCategory] = useState<NewsCategory | undefined>();
  // /news?club=<id>, from a club page's "See news from this club".
  const clubId = useSearchParams().get('club') ?? undefined;
  const feed = useNewsFeed(category, clubId, { enabled: true });
  const clubName = feed.data?.pages[0]?.items[0]?.club?.name;
  const options: (NewsCategory | undefined)[] = [undefined, ...NEWS_CATEGORIES];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={help.feed.filterLabel} className="flex flex-wrap gap-1">
          {options.map((option) => (
            <Button
              key={option ?? 'all'}
              size="sm"
              variant={category === option ? 'default' : 'outline'}
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
            >
              {option ? help.categories[option] : help.feed.all}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/news/mine">{help.feed.mine}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/news/new">{help.feed.write}</Link>
          </Button>
        </div>
      </div>
      {clubId ? (
        <p className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          {clubName ? help.feed.clubFilter(clubName) : help.feed.clubFilterUnknown}
          <Link href="/news" className="text-primary hover:underline">
            {help.feed.clearClub}
          </Link>
        </p>
      ) : null}
      <NewsList query={feed} empty={category ? help.feed.emptyCategory : help.feed.empty} />
    </div>
  );
}

/** /news: published posts, newest first, with a category filter. Wrap in <Suspense> (reads the URL). */
export function NewsFeed() {
  return <LoginGate>{() => <Feed />}</LoginGate>;
}
