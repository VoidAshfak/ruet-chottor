'use client';

import { type ClubMember, formatDateTime } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { PageHeader } from '@/components/guide/PageHeader';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { useClub, useClubActions, useClubMembers } from '../hooks/use-clubs';
import { LoginGate } from './LoginGate';

function Members({ slug }: { slug: string }) {
  const club = useClub(slug);
  const id = club.data?.id ?? '';
  const ready = !!club.data?.canEdit;
  const pending = useClubMembers(id, 'pending', { enabled: ready });
  const active = useClubMembers(id, 'active', { enabled: ready });
  const actions = useClubActions(id);
  const [removing, setRemoving] = useState<ClubMember | null>(null);
  const text = help.members;

  if (club.isPending) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted" aria-hidden />;
  }
  if (club.isError || !club.data.canEdit) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.editor.notAllowed}</p>;
  }

  const requests = pending.data?.pages.flatMap((p) => p.items) ?? [];
  const members = active.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="grid gap-6">
      <Link href={`/clubs/${slug}`} className="text-sm text-primary hover:underline">
        ← {club.data.name}
      </Link>
      <PageHeader title={text.title} description={text.description} />
      <FormError message={actions.approve.error?.message ?? actions.remove.error?.message} />

      <section aria-labelledby="club-requests" className="grid gap-2">
        <h2 id="club-requests" className="font-medium">
          {text.requests} ({requests.length})
        </h2>
        {pending.isPending ? null : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noRequests}</p>
        ) : (
          <ul className="grid gap-2">
            {requests.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              >
                <span className="min-w-0 flex-1 break-words">
                  {person.name}{' '}
                  <span className="text-sm text-muted-foreground">({person.roll})</span>
                </span>
                <Button
                  size="sm"
                  disabled={actions.approve.isPending}
                  onClick={() => actions.approve.mutate(person.id)}
                >
                  {text.approve}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actions.remove.isPending}
                  onClick={() => actions.remove.mutate(person.id)}
                >
                  {text.decline}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="club-members" className="grid gap-2">
        <div className="flex items-center gap-1">
          <h2 id="club-members" className="font-medium">
            {text.list} ({members.length})
          </h2>
          <InfoTip text={text.managersTip} label={text.managersTipLabel} />
        </div>
        {active.isPending ? null : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noMembers}</p>
        ) : (
          <ul className="grid gap-2">
            {members.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
              >
                <span className="min-w-0 flex-1 break-words">
                  {person.name}{' '}
                  <span className="text-sm text-muted-foreground">
                    {person.clubRole === 'manager' ? `· ${help.membership.manager} ` : ''}·{' '}
                    {text.since} {formatDateTime(person.since)}
                  </span>
                </span>
                {person.clubRole === 'member' ? (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(person)}>
                    {text.remove}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {removing ? (
        <ConfirmDialog
          {...text.confirmRemove(removing.name)}
          pending={actions.remove.isPending}
          error={actions.remove.error?.message}
          onClose={() => setRemoving(null)}
          onConfirm={() =>
            actions.remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })
          }
        />
      ) : null}
    </div>
  );
}

/** /clubs/[slug]/members, for the club's managers and admins. */
export function ClubMembers({ slug }: { slug: string }) {
  return <LoginGate>{() => <Members slug={slug} />}</LoginGate>;
}
