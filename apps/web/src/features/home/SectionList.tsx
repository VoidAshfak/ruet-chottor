'use client';

import Link from 'next/link';
import { InfoTip } from '@/components/guide/InfoTip';
import { NAV_MODULES } from '@/lib/modules';
import { useFeatures } from '@/lib/use-features';
import { help } from './help';

/** Every planned section, marked as open or coming soon. */
export function SectionList() {
  const { data, isPending, isError } = useFeatures();
  const enabled = data?.modules ?? [];

  return (
    <section aria-labelledby="sections-heading">
      <div className="mb-3 flex items-center gap-1">
        <h2 id="sections-heading" className="text-lg font-medium">
          Sections
        </h2>
        <InfoTip text={help.tips.sections} />
      </div>

      {isPending ? (
        <p className="mb-3 text-sm text-muted-foreground" role="status">
          {help.status.loading}
        </p>
      ) : null}
      {isError ? (
        <p className="mb-3 text-sm text-muted-foreground" role="status">
          {help.status.offline}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {NAV_MODULES.map((module) => {
          const available = enabled.includes(module.key);
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{module.label}</span>
                {available ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {help.status.available}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{help.status.comingSoon}</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{module.summary}</p>
            </>
          );
          return (
            <li key={module.key}>
              {available ? (
                <Link
                  href={module.href}
                  className="block rounded-lg border p-4 hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {body}
                </Link>
              ) : (
                <div className="rounded-lg border border-dashed p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
