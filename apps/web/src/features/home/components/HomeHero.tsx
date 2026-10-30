'use client';

import { DISPLAY_TIME_ZONE } from '@ruet-chottor/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';
import { CampusArt } from './CampusArt';

/** Morning, afternoon or evening in Rajshahi, whatever the device's clock zone. */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: DISPLAY_TIME_ZONE,
    }).format(new Date()),
  );
  const { morning, afternoon, evening } = help.hero.greeting;
  return hour < 12 ? morning : hour < 17 ? afternoon : evening;
}

/** Welcome for visitors (with sign-up), a greeting for members. */
export function HomeHero() {
  const session = useSession();
  const authOn = useFeatures().data?.modules.includes('auth') ?? false;
  const user = session.user;
  const firstName = user?.name.trim().split(/\s+/)[0];
  const text = help.hero;

  return (
    <section className="grid items-center gap-6 overflow-hidden rounded-2xl bg-accent p-5 sm:p-8 md:grid-cols-[1fr_1.1fr]">
      <div className="grid gap-3">
        <p className="text-sm font-medium text-accent-foreground">{text.tagline}</p>
        <h1 className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">
          {user ? `${greeting()}, ${firstName}` : help.page.title}
        </h1>
        <p className="text-muted-foreground">{user ? text.memberBody : text.body}</p>
        {!user && !session.isPending && authOn ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/signup">{text.signup}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">{text.login}</Link>
            </Button>
          </div>
        ) : null}
      </div>
      <CampusArt label={text.artLabel} bubble={text.bubble} />
    </section>
  );
}
