import { cn } from '@/lib/utils';
import { gearPath } from './gear';
import { help } from './help';

const GEAR = gearPath(60, 28, 9, 17, 12.5);
const RIGHT_PAGE = 'M60 58c9-6 21-7 30-4v30c-9-3-21-2-30 4z';

type RuetLoaderProps = {
  /** What is loading, read out by screen readers and shown under the drawing. */
  label?: string;
  /** Usually a height, so the page does not jump when the content arrives. */
  className?: string;
};

/**
 * The RUET loader: an orange gear for engineering turning over an open book whose page keeps
 * flipping, in the logo's colours. Still (but labelled) for people who prefer reduced motion.
 */
export function RuetLoader({ label = help.loader, className }: RuetLoaderProps) {
  return (
    <div
      role="status"
      className={cn('grid min-h-40 place-content-center justify-items-center gap-2', className)}
    >
      <svg viewBox="0 0 120 100" aria-hidden className="w-28">
        <g className="origin-center animate-gear-spin [transform-box:fill-box] motion-reduce:animate-none">
          <path d={GEAR} fill="var(--brand-orange)" />
          <circle cx="60" cy="28" r="5" fill="var(--background)" />
        </g>

        <g className="animate-bob motion-reduce:animate-none">
          <path d="M24 60v30c14-4 26-2 36 4 10-6 22-8 36-4V60z" fill="var(--primary)" />
          <path d="M60 58c-9-6-21-7-30-4v30c9-3 21-2 30 4z" fill="var(--art-window)" />
          <path d={RIGHT_PAGE} fill="var(--art-window)" />
          <g stroke="var(--art-concrete-dark)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M36 62h18M36 68h18M36 74h12" />
            <path d="M66 62h18M66 68h18M66 74h12" />
          </g>
          <g className="origin-left animate-page-flip [transform-box:fill-box] motion-reduce:animate-none">
            <path d={RIGHT_PAGE} fill="var(--art-cloud)" stroke="var(--art-concrete-dark)" />
            <path
              d="M66 64h16M66 70h12"
              stroke="var(--brand-green)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
          <path d="M60 58v30" stroke="var(--accent-foreground)" strokeWidth="1.5" />
        </g>
      </svg>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        <span aria-hidden className="flex gap-0.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1 animate-dot rounded-full bg-primary motion-reduce:animate-none"
              style={{ animationDelay: `${dot * 0.2}s` }}
            />
          ))}
        </span>
      </p>
    </div>
  );
}
