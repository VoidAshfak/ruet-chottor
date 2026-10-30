'use client';

import { ACCOUNT_STATUSES, ROLES } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/art/EmptyState';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { type MemberFilters, useAdminUsers, useStaff } from '../hooks/use-admin';
import { StatusBadge } from './StatusBadge';

const SEARCH_DELAY_MS = 300;
const selectClass =
  'h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

/** Every member, any status. Staff only (wrap in StaffOnly). */
export function AdminMembers() {
  const { isStaff } = useStaff();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MemberFilters>({ q: '', role: '', status: '' });

  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, q: search.trim() })),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const results = useAdminUsers(filters, { enabled: isStaff });
  const members = results.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="grid gap-6">
      <div role="search" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="grid gap-1.5">
          <Label htmlFor="admin-q">{help.fields.search}</Label>
          <Input
            id="admin-q"
            type="search"
            className="h-10"
            placeholder={help.fields.searchPlaceholder}
            maxLength={80}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="admin-role">{help.fields.role}</Label>
          <select
            id="admin-role"
            className={selectClass}
            value={filters.role}
            onChange={(event) => setFilters({ ...filters, role: event.target.value })}
          >
            <option value="">{help.fields.any}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {help.roles[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="admin-status">{help.fields.status}</Label>
            <InfoTip text={help.tips.status} label={`About ${help.fields.status.toLowerCase()}`} />
          </div>
          <select
            id="admin-status"
            className={selectClass}
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="">{help.fields.any}</option>
            {ACCOUNT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {help.statuses[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {results.isPending ? (
        <p role="status" className="text-muted-foreground">
          {help.states.loading}
        </p>
      ) : results.isError ? (
        <div role="alert" className="rounded-lg border p-6 text-center">
          <p className="text-destructive">{results.error.message}</p>
          <Button variant="outline" className="mt-4" onClick={() => void results.refetch()}>
            {help.states.retry}
          </Button>
        </div>
      ) : members.length === 0 ? (
        <EmptyState>{help.states.empty}</EmptyState>
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <Link
                  href={`/admin/users/${member.id}`}
                  className="font-medium break-words text-primary underline-offset-4 hover:underline"
                >
                  {member.name}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {member.roll} · {help.roles[member.role]}
                </span>
                <span className="ml-auto">
                  <StatusBadge status={member.status} />
                </span>
              </li>
            ))}
          </ul>
          {results.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                disabled={results.isFetchingNextPage}
                onClick={() => void results.fetchNextPage()}
              >
                {results.isFetchingNextPage ? help.states.loading : help.states.loadMore}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
