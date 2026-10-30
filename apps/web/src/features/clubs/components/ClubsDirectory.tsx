'use client';

import { CLUB_CATEGORIES, type ClubCategory } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/art/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { useClubs, useMyClubs } from '../hooks/use-clubs';
import { ClubLogo } from './ClubLogo';
import { LoginGate } from './LoginGate';

const SEARCH_DELAY_MS = 300;

function Directory() {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<ClubCategory | undefined>();
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const clubs = useClubs({ q, category });
  const mine = useMyClubs({ enabled: true });
  const items = clubs.data?.pages.flatMap((page) => page.items) ?? [];
  const options: (ClubCategory | undefined)[] = [undefined, ...CLUB_CATEGORIES];

  return (
    <div className="grid gap-5">
      {mine.data && mine.data.length > 0 ? (
        <section aria-labelledby="my-clubs">
          <h2 id="my-clubs" className="mb-2 text-sm text-muted-foreground">
            {help.list.mine}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {mine.data.map((club) => (
              <li key={club.id}>
                <Link
                  href={`/clubs/${club.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-accent"
                >
                  {club.name}
                  <span className="text-xs text-muted-foreground">
                    {club.myMembership?.state === 'pending'
                      ? help.membership.pending
                      : club.myMembership?.role === 'manager'
                        ? help.membership.manager
                        : help.membership.member}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-3">
        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="club-search">{help.list.search}</Label>
          <Input
            id="club-search"
            type="search"
            value={text}
            placeholder={help.list.searchPlaceholder}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div role="group" aria-label={help.list.filterLabel} className="flex flex-wrap gap-1">
          {options.map((option) => (
            <Button
              key={option ?? 'all'}
              size="sm"
              variant={category === option ? 'default' : 'outline'}
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
            >
              {option ? help.categories[option] : help.list.all}
            </Button>
          ))}
        </div>
      </div>

      {clubs.isPending ? (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label={help.list.loading}>
          {[0, 1, 2, 3].map((row) => (
            <li key={row} className="h-24 animate-pulse rounded-lg border bg-muted" />
          ))}
        </ul>
      ) : clubs.isError ? (
        <div role="alert" className="rounded-lg border p-6 text-center">
          <p className="text-destructive">{clubs.error.message || help.list.error}</p>
          <Button variant="outline" className="mt-4" onClick={() => void clubs.refetch()}>
            {help.list.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState>{help.list.empty}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((club) => (
            <li key={club.id} className="flex gap-3 rounded-lg border p-4">
              <ClubLogo name={club.name} logo={club.logo} />
              <div className="min-w-0">
                <Link
                  href={`/clubs/${club.slug}`}
                  className="font-medium break-words text-primary hover:underline"
                >
                  {club.name}
                </Link>
                <p className="text-sm break-words text-muted-foreground">{club.tagline}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {help.categories[club.category]} · {help.list.members(club.memberCount)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {clubs.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={clubs.isFetchingNextPage}
            onClick={() => void clubs.fetchNextPage()}
          >
            {help.list.loadMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** /clubs: search and browse clubs; the viewer's own clubs on top. */
export function ClubsDirectory() {
  return <LoginGate>{() => <Directory />}</LoginGate>;
}
