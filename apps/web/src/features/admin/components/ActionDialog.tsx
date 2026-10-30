'use client';

import { ADMIN_LIMITS, moderationReasonSchema, ROLES, type Role } from '@ruet-chottor/shared';
import { useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { FormError } from '@/components/form/FormError';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import type { MemberAction } from '../hooks/use-admin';

export type ActionKind = MemberAction['kind'];

type ActionDialogProps = {
  kind: ActionKind;
  currentRole: Role;
  pending: boolean;
  error?: string;
  onConfirm: (action: MemberAction) => void;
  onClose: () => void;
};

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm';

/** Every member action is confirmed here with a reason (CLAUDE.md §7 and §9). */
export function ActionDialog({
  kind,
  currentRole,
  pending,
  error,
  onConfirm,
  onClose,
}: ActionDialogProps) {
  const text = help.actions[kind];
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('7');
  const [role, setRole] = useState<Role>(currentRole);
  const [reasonError, setReasonError] = useState<string>();

  const submit = () => {
    const parsed = moderationReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message);
      return;
    }
    setReasonError(undefined);
    if (kind === 'suspend') onConfirm({ kind, reason: parsed.data, days: Number(days) });
    else if (kind === 'role') onConfirm({ kind, reason: parsed.data, role });
    else onConfirm({ kind, reason: parsed.data });
  };

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
            submit();
          }}
        >
          {kind === 'suspend' ? (
            <div className="grid gap-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="action-days">{help.fields.days}</Label>
                <InfoTip text={help.tips.days} label={`About ${help.fields.days.toLowerCase()}`} />
              </div>
              <Input
                id="action-days"
                type="number"
                inputMode="numeric"
                min={ADMIN_LIMITS.suspendMinDays}
                max={ADMIN_LIMITS.suspendMaxDays}
                className="h-10"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            </div>
          ) : null}

          {kind === 'role' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="action-role">{help.fields.newRole}</Label>
              <select
                id="action-role"
                className={`${fieldClass} h-10 py-0`}
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                {ROLES.map((option) => (
                  <option key={option} value={option}>
                    {help.roles[option]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="action-reason">{help.fields.reason}</Label>
              <InfoTip
                text={help.tips.reason}
                label={`About ${help.fields.reason.toLowerCase()}`}
              />
            </div>
            <textarea
              id="action-reason"
              rows={3}
              maxLength={ADMIN_LIMITS.reasonMaxLength}
              placeholder={help.fields.reasonPlaceholder}
              className={fieldClass}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? 'action-reason-error' : undefined}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {reasonError ? (
              <p id="action-reason-error" className="text-sm text-destructive">
                {reasonError}
              </p>
            ) : null}
          </div>

          <FormError message={error} />

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
              {help.actions.cancel}
            </Button>
            <Button
              type="submit"
              variant={kind === 'ban' || kind === 'suspend' ? 'destructive' : 'default'}
              disabled={pending}
            >
              {pending ? help.actions.working : text.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
