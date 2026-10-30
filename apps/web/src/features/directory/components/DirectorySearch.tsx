'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/art/EmptyState';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { help } from '../help';
import { type DirectoryFilters, useDirectory } from '../hooks/use-directory';
import { DirectoryFilterBar } from './DirectoryFilterBar';
import { MemberCard } from './MemberCard';

const SEARCH_DELAY_MS = 300;

/**
 * Search box, filters and results. Filters live in the URL, so Back from a profile returns to the
 * same search. Wrap in <Suspense> (reads the URL).
 */
export function DirectorySearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const session = useSession();

  const filters: DirectoryFilters = {
    q: params.get('q') ?? '',
    department: params.get('department') ?? '',
    series: params.get('series') ?? '',
    role: params.get('role') ?? '',
  };
  const [search, setSearch] = useState(filters.q);

  const setParams = (next: Partial<DirectoryFilters>) => {
    // Read the live URL, not `params`: the delayed search would otherwise undo newer filter changes.
    const merged = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    const query = merged.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Search after the user pauses typing, not on every key.
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = new URLSearchParams(window.location.search).get('q') ?? '';
      if (search.trim() !== current) setParams({ q: search.trim() });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should restart the delay
  }, [search]);

  const results = useDirectory(filters, { enabled: session.user !== null });
  const members = results.data?.pages.flatMap((page) => page.items) ?? [];

  if (!session.isPending && !session.user) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <p className="text-muted-foreground">{help.loginNeeded}</p>
        <Button asChild className="mt-4">
          <Link href="/login">{help.login}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <DirectoryFilterBar
        search={search}
        filters={filters}
        onSearch={setSearch}
        onFilter={(key, value) => setParams({ [key]: value })}
        onClear={() => {
          setSearch('');
          setParams({ q: '', department: '', series: '', role: '' });
        }}
      />

      <section aria-labelledby="directory-results" aria-busy={results.isFetching}>
        <div className="mb-3 flex items-center gap-1">
          <h2 id="directory-results" className="text-sm text-muted-foreground" aria-live="polite">
            {session.isPending || results.isPending
              ? help.results.loading
              : results.isError
                ? help.results.error
                : help.results.count(members.length, results.hasNextPage)}
          </h2>
          <InfoTip text={help.tips.contact} label={help.results.contactTipLabel} />
        </div>

        {session.isPending || results.isPending ? (
          <ul className="grid gap-3 sm:grid-cols-2" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <li key={row} className="h-24 animate-pulse rounded-lg border bg-muted" />
            ))}
          </ul>
        ) : results.isError ? (
          <div role="alert" className="rounded-lg border p-6 text-center">
            <p className="text-destructive">{results.error.message}</p>
            <Button variant="outline" className="mt-4" onClick={() => void results.refetch()}>
              {help.results.retry}
            </Button>
          </div>
        ) : members.length === 0 ? (
          <EmptyState>{help.results.empty}</EmptyState>
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2">
              {members.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </ul>
            {results.hasNextPage ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  disabled={results.isFetchingNextPage}
                  onClick={() => void results.fetchNextPage()}
                >
                  {results.isFetchingNextPage ? help.results.loadingMore : help.results.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
