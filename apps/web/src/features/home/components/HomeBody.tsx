'use client';

import { MessagesSquareIcon, NewspaperIcon, UsersRoundIcon } from 'lucide-react';
import { InfoTip } from '@/components/guide/InfoTip';
import { useSession } from '@/features/auth';
import { LatestNews } from '@/features/news';
import { NAV_MODULES } from '@/lib/modules';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';

const VALUE_ICONS = [UsersRoundIcon, MessagesSquareIcon, NewspaperIcon];

/** Sections not switched on yet. The menu lists the ones that are, so this never repeats it. */
function ComingSoon({ enabled }: { enabled: readonly string[] }) {
  const upcoming = NAV_MODULES.filter((module) => !enabled.includes(module.key));
  if (upcoming.length === 0) return null;
  return (
    <section aria-labelledby="coming-soon">
      <div className="mb-2 flex items-center gap-1">
        <h2 id="coming-soon" className="text-sm font-medium text-muted-foreground">
          {help.comingSoon.title}
        </h2>
        <InfoTip text={help.comingSoon.tip} label={help.comingSoon.tipLabel} />
      </div>
      <ul className="flex flex-wrap gap-2">
        {upcoming.map((module) => (
          <li
            key={module.key}
            title={module.summary}
            className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground"
          >
            {module.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Below the hero: news for members, what Chottor is for visitors, and what is coming. */
export function HomeBody() {
  const features = useFeatures();
  const session = useSession();
  const enabled = features.data?.modules ?? [];

  if (features.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {help.status.loading}
      </p>
    );
  }
  if (features.isError) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {help.status.offline}
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      {session.user && enabled.includes('news') ? <LatestNews /> : null}
      {session.user ? null : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {help.values.map((value, index) => {
            const Icon = VALUE_ICONS[index]!;
            return (
              <li key={value.title} className="grid gap-1">
                <Icon aria-hidden className="size-6 text-primary" />
                <h2 className="font-medium">{value.title}</h2>
                <p className="text-sm text-muted-foreground">{value.body}</p>
              </li>
            );
          })}
        </ul>
      )}
      <ComingSoon enabled={enabled} />
    </div>
  );
}
