'use client';

import {
  type ClassRepReviewItem,
  formatDateTime,
  moderationReasonSchema,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/art/EmptyState';
import { RuetLoader } from '@/components/art/RuetLoader';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ClassRepListStatus } from '../api';
import { classLabel } from '../class-label';
import { help } from '../help';
import { useClassRepDecision, useClassRepList } from '../hooks/use-class-rep';

const LISTS: ClassRepListStatus[] = ['pending', 'approved'];

type Pending = { kind: 'reject' | 'revoke'; item: ClassRepReviewItem };

/** Staff only (the page wraps it in StaffOnly): verify, turn down or remove class reps. */
export function AdminClassReps() {
  const text = help.classRepAdmin;
  const [status, setStatus] = useState<ClassRepListStatus>('pending');
  const list = useClassRepList(status);
  const decide = useClassRepDecision();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  const close = () => {
    setPending(null);
    setReason('');
    setReasonError(undefined);
  };
  const mutation = pending?.kind === 'revoke' ? decide.revoke : decide.reject;

  return (
    <div className="grid gap-4">
      <div role="group" aria-label={text.listsLabel} className="flex gap-2">
        {LISTS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? 'default' : 'outline'}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {text.lists[value]}
          </Button>
        ))}
      </div>

      {list.isPending ? (
        <RuetLoader label={text.loading} />
      ) : list.isError ? (
        <div role="alert" className="rounded-lg border p-6 text-center">
          <p>{text.error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void list.refetch()}>
            {text.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState>{text.empty[status]}</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="grid gap-2 rounded-lg border p-4">
              <div>
                <Link
                  href={`/admin/users/${item.user.id}`}
                  className="font-medium break-words text-primary hover:underline"
                >
                  {item.user.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {[
                    item.user.roll,
                    classLabel({ ...item.user, section: item.section }),
                    item.status === 'pending'
                      ? text.asked(formatDateTime(item.createdAt))
                      : text.since(formatDateTime(item.reviewedAt ?? item.createdAt)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">{text.proof}</p>
                <p className="break-words whitespace-pre-line">{item.note}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.status === 'pending' ? (
                  <>
                    <Button
                      size="sm"
                      disabled={decide.approve.isPending}
                      onClick={() => decide.approve.mutate(item.id)}
                    >
                      {text.approve}
                    </Button>
                    <InfoTip text={help.tips.classRepVerify} label={`About: ${text.approve}`} />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setPending({ kind: 'reject', item })}
                    >
                      {text.reject}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setPending({ kind: 'revoke', item })}
                  >
                    {text.revoke}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.hasNextPage ? (
        <Button
          variant="outline"
          className="justify-self-center"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? text.loadingMore : text.more}
        </Button>
      ) : null}
      {decide.approve.isSuccess ? (
        <p role="status" className="sr-only">
          {text.verified}
        </p>
      ) : null}
      {decide.approve.error ? (
        <p role="alert" className="text-sm text-destructive">
          {decide.approve.error.message}
        </p>
      ) : null}

      {pending ? (
        <ConfirmDialog
          title={pending.kind === 'revoke' ? text.revokeTitle : text.rejectTitle}
          body={pending.kind === 'revoke' ? text.revokeBody : text.rejectBody}
          confirm={pending.kind === 'revoke' ? text.revoke : text.reject}
          cancel={text.cancel}
          pending={mutation.isPending}
          error={reasonError ?? mutation.error?.message}
          onClose={close}
          onConfirm={() => {
            const parsed = moderationReasonSchema.safeParse(reason);
            if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message);
            mutation.mutate({ id: pending.item.id, reason: parsed.data }, { onSuccess: close });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cr-admin-reason">{text.reason}</Label>
            <textarea
              id="cr-admin-reason"
              rows={3}
              value={reason}
              placeholder={text.reasonPlaceholder}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
