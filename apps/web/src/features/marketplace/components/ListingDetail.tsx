'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RuetLoader } from '@/components/art/RuetLoader';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { MediaGallery } from '@/components/media/MediaGallery';
import { Button } from '@/components/ui/button';
import { StartChatButton } from '@/features/chat';
import { ReportAction, useReportedIds } from '@/features/moderation';
import { ApiError } from '@/lib/api-client';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';
import { useListing, useListingActions } from '../hooks/use-marketplace';
import { LoginGate } from './LoginGate';

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const listing = useListing(id);
  const actions = useListingActions(id);
  const chatOn = useFeatures().data?.modules.includes('chat') ?? false;
  const reported = useReportedIds(
    'marketplace.listing',
    listing.data && !listing.data.isMine ? [id] : [],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const text = help.detail;

  if (listing.isPending) {
    return <RuetLoader className="min-h-64" />;
  }
  if (listing.isError) {
    const missing = listing.error instanceof ApiError && [400, 404].includes(listing.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.notFound : listing.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/marketplace">{text.back}</Link>
        </Button>
      </div>
    );
  }

  const data = listing.data;
  const forSale = data.state !== 'sold' && !data.expired && !data.moderated;
  const stateError = actions.setState.error?.message ?? actions.renew.error?.message;

  return (
    <article className="grid gap-5">
      <Link href="/marketplace" className="text-sm text-primary hover:underline">
        ← {text.back}
      </Link>
      {data.heldFor ? (
        <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
          {text.held(data.heldFor)}
        </p>
      ) : data.moderated ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.moderated}</p>
      ) : null}
      {data.expired ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.expired}</p>
      ) : null}
      {data.state === 'sold' ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.sold}</p>
      ) : null}
      {data.state === 'reserved' ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.reserved}</p>
      ) : null}

      <MediaGallery assets={data.photos} />

      <header className="grid gap-1">
        <p className="text-2xl font-semibold text-primary">{help.price(data.priceTaka)}</p>
        <h1 className="text-xl font-semibold break-words">{data.title}</h1>
        <p className="text-sm text-muted-foreground">{help.categories[data.category]}</p>
      </header>

      <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">{text.condition}</dt>
        <dd>{help.conditions[data.condition]}</dd>
        <dt className="text-muted-foreground">{text.meet}</dt>
        <dd className="break-words">
          {help.places[data.meetPlace]}
          {data.meetDetail ? ` · ${data.meetDetail}` : ''}
        </dd>
        <dt className="text-muted-foreground">{text.seller}</dt>
        <dd>{data.seller?.name ?? '—'}</dd>
      </dl>

      {data.description ? (
        <section aria-labelledby="listing-about">
          <h2 id="listing-about" className="mb-1 font-medium">
            {text.about}
          </h2>
          <p className="break-words whitespace-pre-line text-muted-foreground">
            {data.description}
          </p>
        </section>
      ) : null}

      {data.isMine ? (
        <div className="grid gap-2 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/marketplace/${data.id}/edit`}>{text.edit}</Link>
            </Button>
            {data.state === 'available' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={actions.setState.isPending}
                onClick={() => actions.setState.mutate('reserved')}
              >
                {text.markReserved}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={actions.setState.isPending}
                onClick={() => actions.setState.mutate('available')}
              >
                {text.markAvailable}
              </Button>
            )}
            {data.state !== 'sold' ? (
              <Button
                size="sm"
                disabled={actions.setState.isPending}
                onClick={() => actions.setState.mutate('sold')}
              >
                {text.markSold}
              </Button>
            ) : null}
            {data.expired ? (
              <Button
                size="sm"
                variant="outline"
                disabled={actions.renew.isPending}
                onClick={() => actions.renew.mutate()}
              >
                {text.renew}
              </Button>
            ) : null}
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              {text.delete}
            </Button>
          </div>
          <FormError message={stateError} />
        </div>
      ) : forSale ? (
        <section className="grid gap-3 rounded-lg border p-4">
          <p className="flex items-center gap-1 text-sm font-medium">
            {text.safety}
            <InfoTip text={text.safetyTip} label={text.safetyTipLabel} />
          </p>
          <p className="text-sm">{text.contact}</p>
          {chatOn && data.seller ? (
            <div className="flex">
              <StartChatButton userId={data.seller.id} name={data.seller.name} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{text.noChat}</p>
          )}
        </section>
      ) : null}

      {!data.isMine && !data.moderated ? (
        <div className="border-t pt-3">
          <ReportAction
            contentType="marketplace.listing"
            contentId={data.id}
            reported={reported.has(data.id)}
          />
        </div>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          {...text.confirmDelete}
          pending={actions.remove.isPending}
          error={actions.remove.error?.message}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() =>
            actions.remove.mutate(undefined, { onSuccess: () => router.push('/marketplace/mine') })
          }
        />
      ) : null}
    </article>
  );
}

/** /marketplace/[id] */
export function ListingDetail({ id }: { id: string }) {
  return <LoginGate>{() => <Detail id={id} />}</LoginGate>;
}
