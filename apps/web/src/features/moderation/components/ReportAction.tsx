'use client';

import type { ModeratableContentType } from '@ruet-chottor/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { useModerationEnabled } from '../hooks/use-moderation';
import { ReportDialog } from './ReportDialog';

type ReportActionProps = {
  contentType: ModeratableContentType;
  contentId: string;
  /** From useReportedIds: the viewer already reported this item. */
  reported: boolean;
};

/** "Report" for any piece of content, or "You reported this". Hidden when moderation is off. */
export function ReportAction({ contentType, contentId, reported }: ReportActionProps) {
  const enabled = useModerationEnabled();
  const [open, setOpen] = useState(false);
  const [justSent, setJustSent] = useState(false);

  if (!enabled) return null;
  if (reported || justSent) {
    return (
      <span className="text-xs text-muted-foreground" role={justSent ? 'status' : undefined}>
        {justSent ? help.report.sent : help.report.reported}
      </span>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        aria-label={help.report.buttonLabel}
        onClick={() => setOpen(true)}
      >
        {help.report.button}
      </Button>
      {open ? (
        <ReportDialog
          contentType={contentType}
          contentId={contentId}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            setJustSent(true);
          }}
        />
      ) : null}
    </>
  );
}
