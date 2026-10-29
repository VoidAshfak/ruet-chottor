'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGuideDismissal } from './use-guide-dismissal';

export type GuideStep = { title: string; body: string };

type FirstVisitGuideProps = {
  /** Usually the module key, e.g. "lost-found". */
  moduleKey: string;
  /** 2–4 steps from the module's help.ts. */
  steps: readonly GuideStep[];
};

/** Short intro shown the first time a user opens a section (CLAUDE.md §8). */
export function FirstVisitGuide({ moduleKey, steps }: FirstVisitGuideProps) {
  const { dismissed, dismiss } = useGuideDismissal(moduleKey);
  const [index, setIndex] = useState(0);

  if (dismissed || steps.length === 0) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent>
        <p className="text-xs text-muted-foreground">
          Step {index + 1} of {steps.length}
        </p>
        <DialogTitle>{step.title}</DialogTitle>
        <DialogDescription>{step.body}</DialogDescription>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={dismiss}>
            Skip
          </Button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="outline" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            ) : null}
            <Button onClick={isLast ? dismiss : () => setIndex(index + 1)}>
              {isLast ? 'Done' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
