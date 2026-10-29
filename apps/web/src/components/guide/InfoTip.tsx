'use client';

import { InfoIcon } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type InfoTipProps = {
  /** Plain-language explanation, max ~25 words. Comes from the module's help.ts. */
  text: string;
  label?: string;
};

/**
 * The (i) icon placed next to non-obvious controls (CLAUDE.md §8).
 * Opens on hover with a mouse, and on tap or keyboard everywhere else.
 */
export function InfoTip({ text, label = 'More info' }: InfoTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={label}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onPointerEnter={(event) => event.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setOpen(false)}
      >
        <InfoIcon className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-auto max-w-64 text-sm"
        // Hover-opened tips must not steal focus from what the user is doing.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
