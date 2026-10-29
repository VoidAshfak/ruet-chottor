'use client';

import { InfoTip } from '@/components/guide/InfoTip';
import { FormError } from '@/components/form/FormError';
import { Button } from '@/components/ui/button';
import { help } from '../help';
import { useResetGuides } from '../hooks/use-my-profile';

export function GuideReset() {
  const reset = useResetGuides();

  return (
    <section className="rounded-lg border p-4 sm:p-6" aria-labelledby="guides-heading">
      <h2 id="guides-heading" className="text-lg font-semibold">
        {help.guides.heading}
      </h2>
      <div className="mt-3 flex items-center gap-1">
        <Button variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
          {reset.isPending ? help.guides.resetting : help.guides.reset}
        </Button>
        <InfoTip text={help.tips.reset} label={`About: ${help.guides.reset.toLowerCase()}`} />
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-muted-foreground">
        {reset.isSuccess ? help.guides.done : null}
      </p>
      <FormError message={reset.error?.message} />
    </section>
  );
}
