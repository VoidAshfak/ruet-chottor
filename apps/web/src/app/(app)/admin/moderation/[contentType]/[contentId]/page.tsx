import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/guide/PageHeader';
import { AdminTabs, adminHelp, StaffOnly } from '@/features/admin';
import { ModerationItemDetail } from '@/features/moderation';

export const metadata: Metadata = { title: adminHelp.moderation.itemTitle };

export default function ModerationItemPage({
  params,
}: PageProps<'/admin/moderation/[contentType]/[contentId]'>) {
  return (
    <>
      <PageHeader
        title={adminHelp.moderation.itemTitle}
        description={adminHelp.moderation.itemDescription}
      />
      <StaffOnly>
        <AdminTabs />
        {/* The ids are only known at request time (Cache Components), so they are read inside Suspense. */}
        <Suspense>
          {params.then(({ contentType, contentId }) => (
            <ModerationItemDetail contentType={contentType} contentId={contentId} />
          ))}
        </Suspense>
      </StaffOnly>
    </>
  );
}
