'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RuetLoader } from '@/components/art/RuetLoader';
import { ConfirmDialog } from '@/components/dialog/ConfirmDialog';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { StartChatButton } from '@/features/chat';
import { ReportAction, useReportedIds } from '@/features/moderation';
import { ApiError } from '@/lib/api-client';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';
import { useItem, useItemActions } from '../hooks/use-lost-found';
import { formatDay } from './ItemCard';
import { ItemPhoto } from './ItemPhoto';
import { LoginGate } from './LoginGate';

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const item = useItem(id);
  const actions = useItemActions(id);
  const chatOn = useFeatures().data?.modules.includes('chat') ?? false;
  const reported = useReportedIds('lost-found.item', item.data && !item.data.isMine ? [id] : []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const text = help.detail;

  if (item.isPending) {
    return <RuetLoader className="min-h-64" />;
  }
  if (item.isError) {
    const missing = item.error instanceof ApiError && [400, 404].includes(item.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.notFound : item.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/lost-found">{text.back}</Link>
        </Button>
      </div>
    );
  }

  const data = item.data;
  const open = data.state === 'open' && !data.expired;
  const blurred = data.kind === 'found' && !data.isMine;

  return (
    <article className="grid gap-5">
      <Link href="/lost-found" className="text-sm text-primary hover:underline">
        ← {text.back}
      </Link>
      <header className="grid gap-1">
        <p className="text-sm text-muted-foreground">
          {help.kinds[data.kind]} · {help.categories[data.category]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight break-words">{data.title}</h1>
      </header>
      {data.moderated ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.moderated}</p>
      ) : null}
      {data.expired ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{text.expired}</p>
      ) : null}
      {data.state !== 'open' ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          {text.done(help.states[data.state])}
        </p>
      ) : null}

      {data.photos.length > 0 ? (
        <div className={`grid gap-2 ${data.photos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {data.photos.map((photo, index) => (
            <ItemPhoto
              key={photo.id}
              photo={photo}
              blurred={blurred}
              alt={`${data.title} ${index + 1}`}
            />
          ))}
        </div>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">{text.where}</dt>
        <dd className="break-words">
          {help.places[data.place]}
          {data.placeDetail ? ` · ${data.placeDetail}` : ''}
        </dd>
        <dt className="text-muted-foreground">{text.when}</dt>
        <dd>{formatDay(data.happenedOn)}</dd>
        <dt className="text-muted-foreground">{text.postedBy}</dt>
        <dd>{data.poster?.name ?? '—'}</dd>
      </dl>

      {data.description ? (
        <section aria-labelledby="lf-about">
          <h2 id="lf-about" className="mb-1 font-medium">
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
              <Link href={`/lost-found/${data.id}/edit`}>{text.edit}</Link>
            </Button>
            {open ? (
              <>
                <Button
                  size="sm"
                  disabled={actions.setState.isPending}
                  onClick={() => actions.setState.mutate('returned')}
                >
                  {text.markReturned}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actions.setState.isPending}
                  onClick={() => actions.setState.mutate('closed')}
                >
                  {text.close}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={actions.setState.isPending}
                onClick={() => actions.setState.mutate('open')}
              >
                {text.reopen}
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              {text.delete}
            </Button>
          </div>
          <FormError message={actions.setState.error?.message} />
        </div>
      ) : open && !data.moderated ? (
        <section className="grid gap-3 rounded-lg border p-4">
          {data.verifyQuestion ? (
            <div className="grid gap-1 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                {text.checkQuestion}
                <InfoTip text={text.checkTip} label={text.checkTipLabel} />
              </span>
              <span className="font-medium break-words">“{data.verifyQuestion}”</span>
            </div>
          ) : null}
          <p className="text-sm">{data.kind === 'lost' ? text.contactLost : text.contactFound}</p>
          {chatOn && data.poster ? (
            <div className="flex">
              <StartChatButton userId={data.poster.id} name={data.poster.name} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{text.noChat}</p>
          )}
        </section>
      ) : null}

      {!data.isMine && !data.moderated ? (
        <div className="border-t pt-3">
          <ReportAction
            contentType="lost-found.item"
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
            actions.remove.mutate(undefined, { onSuccess: () => router.push('/lost-found/mine') })
          }
        />
      ) : null}
    </article>
  );
}

/** /lost-found/[id] */
export function ItemDetail({ id }: { id: string }) {
  return <LoginGate>{() => <Detail id={id} />}</LoginGate>;
}
