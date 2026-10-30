import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  /** One sentence saying what the page is for (CLAUDE.md §8). */
  description: string;
  /** Optional actions shown on the right, e.g. a "New post" button. */
  actions?: ReactNode;
  /** Centre the title, e.g. on a page with an illustration above it. */
  centered?: boolean;
};

export function PageHeader({ title, description, actions, centered = false }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        centered && 'items-center text-center sm:flex-col sm:items-center',
      )}
    >
      <div className={cn(centered && 'grid justify-items-center')}>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {/* a hand-drawn squiggle, like underlining a heading in a notebook */}
        <svg viewBox="0 0 80 8" aria-hidden className="mt-1 h-2 w-16">
          <path
            d="M2 5q6-4 12 0t12 0 12 0 12 0 12 0 12 0"
            fill="none"
            stroke="var(--brand-orange)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}
