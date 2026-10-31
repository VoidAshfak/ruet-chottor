'use client';

import {
  CLASS_SECTIONS,
  type ClassSection,
  classRepApplyRequestSchema,
  formatDateTime,
  type MyProfile,
} from '@ruet-chottor/shared';
import { type FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { classLabel } from '../class-label';
import { help } from '../help';
import { useMyClassRep, useMyClassRepActions } from '../hooks/use-class-rep';
import { ClassRepBadge } from './ClassRepBadge';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm';

const NO_SECTION = 'none';

/** Ask to be verified as your class's CR, see where the request stands, or step down. */
export function ClassRepCard({ profile }: { profile: MyProfile }) {
  const text = help.classRep;
  const mine = useMyClassRep({ enabled: true });
  const actions = useMyClassRepActions();
  const [confirming, setConfirming] = useState(false);
  const label = classLabel(profile);
  const request = mine.data?.request ?? null;

  let body;
  if (mine.isPending) {
    body = <div className="h-24 animate-pulse rounded-lg bg-muted" aria-hidden />;
  } else if (mine.isError) {
    body = (
      <div role="alert" className="grid justify-items-start gap-2 text-sm">
        <p>{text.loadError}</p>
        <Button variant="outline" size="sm" onClick={() => void mine.refetch()}>
          {help.states.retry}
        </Button>
      </div>
    );
  } else if (request?.status === 'pending' || request?.status === 'approved') {
    const approved = request.status === 'approved';
    body = (
      <div className="grid justify-items-start gap-3">
        {approved ? (
          <ClassRepBadge
            badge={{ section: request.section, since: request.reviewedAt ?? request.createdAt }}
          />
        ) : null}
        <p className="text-sm">
          {approved
            ? text.approved(formatDateTime(request.reviewedAt ?? request.createdAt))
            : text.pending(formatDateTime(request.createdAt))}
        </p>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          {approved ? text.stepDown : text.withdraw}
        </Button>
        {confirming ? (
          <ConfirmDialog
            title={approved ? text.confirmStepDown.title : text.confirmWithdraw.title}
            body={approved ? text.confirmStepDown.body : text.confirmWithdraw.body}
            confirm={approved ? text.stepDown : text.withdraw}
            cancel={text.cancel}
            pending={actions.withdraw.isPending}
            error={actions.withdraw.error?.message}
            onClose={() => setConfirming(false)}
            onConfirm={() =>
              actions.withdraw.mutate(undefined, { onSuccess: () => setConfirming(false) })
            }
          />
        ) : null}
      </div>
    );
  } else {
    body = (
      <div className="grid gap-4">
        {request?.status === 'rejected' || request?.status === 'revoked' ? (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p>{request.status === 'rejected' ? text.rejected : text.revoked}</p>
            {request.reviewNote ? (
              <p className="text-muted-foreground">{text.reason(request.reviewNote)}</p>
            ) : null}
          </div>
        ) : null}
        {label ? <ApplyForm classText={label} /> : <p className="text-sm">{text.unknownClass}</p>}
      </div>
    );
  }

  return (
    <section className="rounded-lg border p-4 sm:p-6" aria-labelledby="cr-heading">
      <div className="flex items-center gap-1">
        <h2 id="cr-heading" className="text-lg font-semibold">
          {text.heading}
        </h2>
        <InfoTip text={help.tips.classRep} label={`About: ${text.heading.toLowerCase()}`} />
      </div>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{text.description}</p>
      {body}
    </section>
  );
}

function ApplyForm({ classText }: { classText: string }) {
  const text = help.classRep;
  const { apply } = useMyClassRepActions();
  const [section, setSection] = useState<string>('A');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = classRepApplyRequestSchema.safeParse({
      section: section === NO_SECTION ? null : (section as ClassSection),
      note,
    });
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0]?.message);
      return;
    }
    setNoteError(undefined);
    apply.mutate(parsed.data);
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <p className="text-sm font-medium">{text.forClass(classText)}</p>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor="cr-section">{text.section}</Label>
          <InfoTip
            text={help.tips.classRepSection}
            label={`About: ${text.section.toLowerCase()}`}
          />
        </div>
        <select
          id="cr-section"
          value={section}
          onChange={(event) => setSection(event.target.value)}
          className={`${fieldClass} h-10 sm:max-w-xs`}
        >
          {CLASS_SECTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
          <option value={NO_SECTION}>{text.noSections}</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor="cr-note">{text.note}</Label>
          <InfoTip text={help.tips.classRepNote} label={`About: ${text.note.toLowerCase()}`} />
        </div>
        <textarea
          id="cr-note"
          rows={3}
          value={note}
          placeholder={text.notePlaceholder}
          aria-invalid={noteError ? true : undefined}
          aria-describedby={noteError ? 'cr-note-error' : undefined}
          className={fieldClass}
          onChange={(event) => setNote(event.target.value)}
        />
        {noteError ? (
          <p id="cr-note-error" className="text-sm text-destructive">
            {noteError}
          </p>
        ) : null}
      </div>
      <FormError message={apply.error?.message} />
      <div>
        <Button type="submit" disabled={apply.isPending}>
          {apply.isPending ? text.asking : text.ask}
        </Button>
      </div>
    </form>
  );
}
