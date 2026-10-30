import type { AccountStatus } from '@ruet-chottor/shared';
import { cn } from 'cn';
import { help } from '../help';

const STYLES: Record<AccountStatus, string> = {
  active: 'border-border text-muted-foreground',
  suspended: 'border-destructive/40 text-destructive',
  banned: 'border-destructive bg-destructive/10 text-destructive',
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', STYLES[status])}>
      {help.statuses[status]}
    </span>
  );
}
