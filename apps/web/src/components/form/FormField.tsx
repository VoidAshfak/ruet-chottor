import type { ComponentProps } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormFieldProps = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  /** Optional (i) explanation from the module's help.ts. */
  tip?: string;
  error?: string;
};

/** Label + optional info tip + input + error message, wired up for screen readers. */
export function FormField({ id, label, tip, error, ...inputProps }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        {tip ? <InfoTip text={tip} label={`About ${label.toLowerCase()}`} /> : null}
      </div>
      <Input
        id={id}
        className="h-10"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
