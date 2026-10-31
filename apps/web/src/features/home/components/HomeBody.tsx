'use client';

import { RuetLoader } from '@/components/art/RuetLoader';
import { InfoTip } from '@/components/guide/InfoTip';
import { useSession } from '@/features/auth';
import { LatestNews } from '@/features/news';
import { NAV_MODULES } from '@/lib/modules';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';
import { QuickActions } from './QuickActions';
import { SectionGrid } from './SectionGrid';
import { VisitorGuide } from './VisitorGuide';

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

/**
 * Below the hero. Members: shortcuts and the latest news. Everyone: a card per section.
 * Visitors: how to join and what keeps the square safe. Then anything still coming.
 */
export function HomeBody() {
  const features = useFeatures();
  const session = useSession();
  const enabled = features.data?.modules ?? [];

  if (features.isPending) {
    return <RuetLoader label={help.status.loading} />;
  }
  if (features.isError) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {help.status.offline}
      </p>
    );
  }

  return (
    <div className="grid gap-10">
      {session.user ? <QuickActions enabled={enabled} /> : null}
      {session.user && enabled.includes('news') ? <LatestNews /> : null}
      <SectionGrid enabled={enabled} />
      {!session.user && !session.isPending ? <VisitorGuide /> : null}
      <ComingSoon enabled={enabled} />
    </div>
  );
}
