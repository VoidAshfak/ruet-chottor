'use client';

import { ADMIN_LIMITS, type ContentAction, moderationReasonSchema } from '@ruet-chottor/shared';
import { useState } from 'react';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { help } from '../help';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm';

type ContentActionDialogProps = {
  action: ContentAction;
  pending: boolean;
  error?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

/** Every moderator action is confirmed with a reason (CLAUDE.md §7 and §9). */
export function ContentActionDialog({
  action,
  pending,
  error,
  onConfirm,
  onClose,
}: ContentActionDialogProps) {
  const text = help.actions[action];
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogTitle>{text.title}</DialogTitle>
        <DialogDescription>{text.body}</DialogDescription>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = moderationReasonSchema.safeParse(reason);
            if (!parsed.success) return setReasonError(parsed.error.issues[0]?.message);
            setReasonError(undefined);
            onConfirm(parsed.data);
          }}
        >
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="content-action-reason">{help.reasonField}</Label>
              <InfoTip text={help.tips.reason} label={help.reasonField} />
            </div>
            <textarea
              id="content-action-reason"
              rows={3}
              maxLength={ADMIN_LIMITS.reasonMaxLength}
              placeholder={help.reasonPlaceholder}
              className={fieldClass}
              aria-invalid={reasonError ? true : undefined}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {reasonError ? <p className="text-sm text-destructive">{reasonError}</p> : null}
          </div>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {help.cancel}
            </Button>
            <Button
              type="submit"
              variant={action === 'restore' || action === 'dismiss' ? 'default' : 'destructive'}
              disabled={pending}
            >
              {text.button}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
