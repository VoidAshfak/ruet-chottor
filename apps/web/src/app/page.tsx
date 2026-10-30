import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { HomeBody, HomeHero, homeHelp } from '@/features/home';

/** The hero holds the page title and one-line description (CLAUDE.md §8). */
export default function HomePage() {
  return (
    <div className="grid gap-8">
      <HomeHero />
      <HomeBody />
      <FirstVisitGuide moduleKey="home" steps={homeHelp.intro} />
    </div>
  );
}
