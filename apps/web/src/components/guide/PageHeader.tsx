import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  /** One sentence saying what the page is for (CLAUDE.md §8). */
  description: string;
  /** Optional actions shown on the right, e.g. a "New post" button. */
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}
