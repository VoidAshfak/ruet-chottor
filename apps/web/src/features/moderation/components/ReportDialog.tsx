'use client';

import {
  MODERATION_LIMITS,
  type ModeratableContentType,
  REPORT_REASONS,
  type ReportReason,
} from '@ruet-chottor/shared';
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
import { useReport } from '../hooks/use-moderation';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

type ReportDialogProps = {
  contentType: ModeratableContentType;
  contentId: string;
  onDone: () => void;
  onClose: () => void;
};

export function ReportDialog({ contentType, contentId, onDone, onClose }: ReportDialogProps) {
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const text = help.report;

  const submit = () => {
    if (!reason) return setError(text.needReason);
    setError(undefined);
    report.mutate({ contentType, contentId, reason, note }, { onSuccess: onDone });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !report.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>{text.title(contentType)}</DialogTitle>
        <DialogDescription className="flex items-center gap-1">
          {text.description}
          <InfoTip text={help.tips.report[contentType]} label={text.tipLabel} />
        </DialogDescription>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">{text.reason}</legend>
            {REPORT_REASONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="report-reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                />
                {help.reasons[option]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor="report-note">{text.note}</Label>
            <textarea
              id="report-note"
              rows={3}
              maxLength={MODERATION_LIMITS.noteMaxLength}
              placeholder={text.notePlaceholder}
              className={fieldClass}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <FormError message={error ?? report.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={report.isPending} onClick={onClose}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={report.isPending}>
              {text.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
