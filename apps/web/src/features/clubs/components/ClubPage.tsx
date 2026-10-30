'use client';

import type { ClubDetail } from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { ReportAction, useReportedIds } from '@/features/moderation';
import { ApiError } from '@/lib/api-client';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';
import { useClub, useClubActions } from '../hooks/use-clubs';
import { ClubLogo } from './ClubLogo';
import { LoginGate } from './LoginGate';

function MembershipButton({ club }: { club: ClubDetail }) {
  const actions = useClubActions(club.id);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const membership = club.myMembership;
  const text = help.membership;
  const error = actions.join.error?.message ?? actions.leave.error?.message;

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!membership ? (
          <>
            <Button disabled={actions.join.isPending} onClick={() => actions.join.mutate()}>
              {actions.join.isPending ? text.joining : text.join}
            </Button>
            <InfoTip text={text.joinTip} label={text.joinTipLabel} />
          </>
        ) : membership.state === 'pending' ? (
          <>
            <span className="text-sm font-medium">{text.pending}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={actions.leave.isPending}
              onClick={() => actions.leave.mutate()}
            >
              {text.cancel}
            </Button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-accent px-2 py-0.5 text-sm text-accent-foreground">
              {membership.role === 'manager' ? text.manager : text.member}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(true)}>
              {text.leave}
            </Button>
          </>
        )}
      </div>
      <FormError message={error} />
      {confirmLeave ? (
        <ConfirmDialog
          {...text.confirmLeave}
          pending={actions.leave.isPending}
          error={actions.leave.error?.message}
          onClose={() => setConfirmLeave(false)}
          onConfirm={() =>
            actions.leave.mutate(undefined, { onSuccess: () => setConfirmLeave(false) })
          }
        />
      ) : null}
    </div>
  );
}

function Club({ slug }: { slug: string }) {
  const club = useClub(slug);
  const modules = useFeatures().data?.modules ?? [];
  const newsOn = modules.includes('news');
  const eventsOn = modules.includes('events');
  const reported = useReportedIds(
    'clubs.club',
    club.data && !club.data.canEdit ? [club.data.id] : [],
  );
  const text = help.detail;

  if (club.isPending) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted" aria-hidden />;
  }
  if (club.isError) {
    const missing = club.error instanceof ApiError && [400, 404].includes(club.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.notFound : club.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/clubs">{text.back}</Link>
        </Button>
      </div>
    );
  }

  const data = club.data;
  return (
    <article className="grid gap-5">
      <Link href="/clubs" className="text-sm text-primary hover:underline">
        ← {text.back}
      </Link>
      {data.cover?.url ? (
        // Cloudinary serves a size that fits; next/image would resize it again on our server.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.cover.url}
          alt=""
          className="max-h-64 w-full rounded-lg border object-cover"
        />
      ) : null}
      <header className="flex items-start gap-4">
        <ClubLogo name={data.name} logo={data.logo} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{data.name}</h1>
          <p className="text-muted-foreground">{data.tagline}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {help.categories[data.category]} · {help.list.members(data.memberCount)}
          </p>
        </div>
      </header>
      {data.moderated ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.moderated}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {data.moderated ? null : <MembershipButton club={data} />}
        {data.canEdit ? (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/clubs/${data.slug}/edit`}>{text.edit}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/clubs/${data.slug}/members`}>{text.members}</Link>
            </Button>
          </>
        ) : null}
      </div>

      <section aria-labelledby="club-about">
        <h2 id="club-about" className="mb-1 font-medium">
          {text.about}
        </h2>
        <p className="break-words whitespace-pre-line text-muted-foreground">
          {data.about || text.noAbout}
        </p>
      </section>

      <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">{text.managers}</dt>
        <dd>{data.managers.map((m) => m.name).join(', ')}</dd>
        {data.contactEmail ? (
          <>
            <dt className="text-muted-foreground">{text.contact}</dt>
            <dd className="break-all">
              <a href={`mailto:${data.contactEmail}`} className="text-primary hover:underline">
                {data.contactEmail}
              </a>
            </dd>
          </>
        ) : null}
        {data.links.length > 0 ? (
          <>
            <dt className="text-muted-foreground">{text.links}</dt>
            <dd>
              <ul className="grid gap-1">
                {data.links.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-primary hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        ) : null}
        {eventsOn ? (
          <>
            <dt className="text-muted-foreground">{text.events}</dt>
            <dd>
              <Link href={`/events?club=${data.id}`} className="text-primary hover:underline">
                {text.eventsLink}
              </Link>
            </dd>
          </>
        ) : null}
        {newsOn ? (
          <>
            <dt className="text-muted-foreground">{text.news}</dt>
            <dd>
              <Link href={`/news?club=${data.id}`} className="text-primary hover:underline">
                {text.newsLink}
              </Link>
            </dd>
          </>
        ) : null}
      </dl>

      {!data.canEdit && !data.moderated ? (
        <div className="border-t pt-3">
          <ReportAction
            contentType="clubs.club"
            contentId={data.id}
            reported={reported.has(data.id)}
          />
        </div>
      ) : null}
    </article>
  );
}

/** /clubs/[slug] */
export function ClubPage({ slug }: { slug: string }) {
  return <LoginGate>{() => <Club slug={slug} />}</LoginGate>;
}
