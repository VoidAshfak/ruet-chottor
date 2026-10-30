import type { ReactNode } from 'react';

/**
 * What a list shows when it has nothing in it: an open notebook with a pencil resting on it,
 * above the message, in a dashed box.
 */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed bg-background p-6 text-center text-muted-foreground">
      <svg viewBox="0 0 96 64" aria-hidden className="w-20">
        <path d="M8 18c14-8 28-8 40 0v38c-12-8-26-8-40 0z" fill="var(--accent)" />
        <path d="M88 18c-14-8-28-8-40 0v38c12-8 26-8 40 0z" fill="var(--accent)" />
        <g stroke="var(--primary)" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M8 18c14-8 28-8 40 0v38c-12-8-26-8-40 0zM88 18c-14-8-28-8-40 0v38c12-8 26-8 40 0z" />
          <path d="M18 28h20M18 36h14M58 28h20" opacity="0.5" />
        </g>
        <g className="origin-center animate-bob [transform-box:fill-box] motion-reduce:animate-none">
          <path d="M60 50l26-26 6 6-26 26-8 2z" fill="var(--brand-orange)" />
          <path d="M86 24l6 6" stroke="var(--art-ink)" strokeWidth="3" />
        </g>
      </svg>
      <p>{children}</p>
    </div>
  );
}
