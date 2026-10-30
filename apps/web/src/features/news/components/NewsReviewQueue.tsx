'use client';

import { moderationReasonSchema } from '@ruet-chottor/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { useNewsDecision, useNewsReviewQueue } from '../hooks/use-news';
import { ConfirmDialog } from './ConfirmDialog';
import { NewsList } from './NewsList';

/** Staff only (the page wraps it in StaffOnly): approve or reject waiting posts. */
export function NewsReviewQueue() {
  const queue = useNewsReviewQueue();
  const decide = useNewsDecision();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const text = help.staff;

  return (
    <>
      <NewsList
        query={queue}
        empty={text.queueEmpty}
        renderActions={(id) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={decide.approve.isPending}
              onClick={() => decide.approve.mutate(id)}
            >
              {text.approve}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setRejecting(id)}>
              {text.reject}
            </Button>
          </div>
        )}
      />
      {decide.approve.isSuccess ? (
        <p role="status" className="sr-only">
          {text.approved}
        </p>
      ) : null}
      {rejecting ? (
        <ConfirmDialog
          title={text.rejectTitle}
          body={text.rejectBody}
          confirm={text.reject}
          cancel={text.cancel}
          pending={decide.reject.isPending}
          error={reasonError ?? decide.reject.error?.message}
          onClose={() => {
            setRejecting(null);
            setReason('');
            setReasonError(undefined);
          }}
          onConfirm={() => {
            const parsed = moderationReasonSchema.safeParse(reason);
            if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message);
            decide.reject.mutate(
              { id: rejecting, reason: parsed.data },
              {
                onSuccess: () => {
                  setRejecting(null);
                  setReason('');
                  setReasonError(undefined);
                },
              },
            );
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="reject-reason">{text.reason}</Label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              placeholder={text.reasonPlaceholder}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
