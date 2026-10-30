import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { NotificationsInbox, notificationsHelp } from '@/features/notifications';

export const metadata: Metadata = { title: notificationsHelp.page.title };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title={notificationsHelp.page.title}
        description={notificationsHelp.page.description}
      />
      <NotificationsInbox />
      <FirstVisitGuide moduleKey="notifications" steps={notificationsHelp.intro} />
    </>
  );
}
