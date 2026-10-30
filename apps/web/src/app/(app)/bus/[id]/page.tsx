import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { busHelp, RouteDetail } from '@/features/bus';

export const metadata: Metadata = { title: busHelp.route.title };

export default function BusRoutePage({ params }: PageProps<'/bus/[id]'>) {
  return (
    <>
      {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense>
        {params.then(({ id }) => (
          <RouteDetail id={id} />
        ))}
      </Suspense>
      <FirstVisitGuide moduleKey="bus" steps={busHelp.intro} />
    </>
  );
}
