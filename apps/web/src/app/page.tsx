import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { homeHelp, SectionList } from '@/features/home';

export default function HomePage() {
  return (
    <>
      <PageHeader title={homeHelp.page.title} description={homeHelp.page.description} />
      <SectionList />
      <FirstVisitGuide moduleKey="home" steps={homeHelp.intro} />
    </>
  );
}
