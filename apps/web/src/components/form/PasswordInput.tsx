'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from 'cn';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'> & {
  /** Button labels from the module's help.ts, e.g. "Show password" / "Hide password". */
  showLabel: string;
  hideLabel: string;
};

/** Password input with a button that reveals what was typed, to catch typos on phones. */
export function PasswordInput({ showLabel, hideLabel, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <button
        type="button"
        aria-label={visible ? hideLabel : showLabel}
        aria-controls={props.id}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {visible ? (
          <EyeOffIcon className="size-4" aria-hidden />
        ) : (
          <EyeIcon className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
