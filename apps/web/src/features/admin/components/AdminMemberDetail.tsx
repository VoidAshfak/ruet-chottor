'use client';

import { formatDateTime } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { help } from '../help';
import { useAdminUser, useMemberAction, useStaff } from '../hooks/use-admin';
import { type ActionKind, ActionDialog } from './ActionDialog';
import { LogEntry } from './LogEntry';
import { StatusBadge } from './StatusBadge';

/** One member's account, actions and moderation history. Staff only (wrap in StaffOnly). */
export function AdminMemberDetail({ userId }: { userId: string }) {
  const { user: me, isStaff, isAdmin } = useStaff();
  const detail = useAdminUser(userId, { enabled: isStaff });
  const action = useMemberAction(userId);
  const [open, setOpen] = useState<ActionKind | null>(null);

  if (detail.isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        {help.states.loading}
      </p>
    );
  }
  if (detail.isError) {
    const missing = detail.error instanceof ApiError && [400, 404].includes(detail.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.member.notFound : detail.error.message}
        </p>
        {missing ? null : (
          <Button variant="outline" className="mt-4" onClick={() => void detail.refetch()}>
            {help.states.retry}
          </Button>
        )}
      </div>
    );
  }

  const { user, history } = detail.data;
  const isSelf = me?.id === user.id;
  const targetIsStaff = user.role === 'moderator' || user.role === 'admin';
  // Mirrors the server rules so staff only see buttons that will work.
  const canAct = !isSelf && (isAdmin || !targetIsStaff);
  const kinds: ActionKind[] = canAct
    ? [
        'warn',
        ...(user.status === 'banned' ? [] : (['suspend'] as const)),
        ...(user.status === 'banned' ? [] : (['ban'] as const)),
        ...(user.status === 'active' ? [] : (['reinstate'] as const)),
        ...(isAdmin ? (['role'] as const) : []),
      ]
    : [];

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold break-words">{user.name}</h2>
          <StatusBadge status={user.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.roll} · {help.roles[user.role]} · {help.member.joined}{' '}
          {formatDateTime(user.createdAt)}
        </p>
        {user.status === 'suspended' && user.suspendedUntil ? (
          <p className="mt-2 text-sm">
            {help.member.suspendedUntil} {formatDateTime(user.suspendedUntil)}
          </p>
        ) : null}
        <Link
          href={`/users/${user.id}`}
          className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          {help.member.publicProfile}
        </Link>
      </section>

      <section aria-labelledby="actions-heading" className="rounded-lg border p-4 sm:p-6">
        <div className="flex items-center gap-1">
          <h2 id="actions-heading" className="text-lg font-semibold">
            {help.member.actions}
          </h2>
          <InfoTip
            text={help.tips.staffTargets}
            label={`About ${help.member.actions.toLowerCase()}`}
          />
        </div>
        {kinds.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {kinds.map((kind) => (
              <Button
                key={kind}
                variant={kind === 'ban' || kind === 'suspend' ? 'destructive' : 'outline'}
                onClick={() => {
                  action.reset();
                  setOpen(kind);
                }}
              >
                {help.actions[kind].button}
              </Button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{help.tips.staffTargets}</p>
        )}
        <p role="status" className="mt-3 min-h-5 text-sm text-muted-foreground">
          {action.isSuccess && open === null ? help.actions.done : null}
        </p>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-lg font-semibold">
          {help.member.history}
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{help.member.noHistory}</p>
        ) : (
          <ul className="grid gap-2">
            {history.map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      {open ? (
        <ActionDialog
          kind={open}
          currentRole={user.role}
          pending={action.isPending}
          error={action.error?.message}
          onClose={() => setOpen(null)}
          onConfirm={(request) => action.mutate(request, { onSuccess: () => setOpen(null) })}
        />
      ) : null}
    </div>
  );
}
