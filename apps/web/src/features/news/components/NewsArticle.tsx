'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RuetLoader } from '@/components/art/RuetLoader';
import { MediaGallery } from '@/components/media/MediaGallery';
import { Button } from '@/components/ui/button';
import { ReportAction, useReportedIds } from '@/features/moderation';
import { ApiError } from '@/lib/api-client';
import { help } from '../help';
import { useDeleteNews, useNewsPost } from '../hooks/use-news';
import { ConfirmDialog } from './ConfirmDialog';
import { LoginGate } from './LoginGate';
import { NewsMeta } from './NewsMeta';
import { ReviewBadge } from './ReviewBadge';

function Article({ id, myId }: { id: string; myId: string }) {
  const router = useRouter();
  const post = useNewsPost(id, { enabled: true });
  const remove = useDeleteNews();
  const [confirming, setConfirming] = useState(false);
  const reported = useReportedIds(
    'news.post',
    post.data && post.data.author?.id !== myId ? [id] : [],
  );

  if (post.isPending) {
    return <RuetLoader className="min-h-64" />;
  }
  if (post.isError) {
    const missing = post.error instanceof ApiError && [400, 404].includes(post.error.status);
    return (
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className={missing ? 'text-muted-foreground' : 'text-destructive'}>
          {missing ? help.notFound : post.error.message}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/news">{help.back}</Link>
        </Button>
      </div>
    );
  }

  const data = post.data;
  const mine = data.author?.id === myId;
  const published = data.review === 'approved' && !data.moderated;

  return (
    <article className="grid gap-4">
      <Link href="/news" className="text-sm text-primary hover:underline">
        ← {help.back}
      </Link>
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{data.title}</h1>
        <NewsMeta post={data} />
      </header>
      <ReviewBadge post={data} />
      <MediaGallery assets={data.media} />
      <p className="break-words whitespace-pre-line">{data.body}</p>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {mine ? (
          <>
            {!data.moderated ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/news/${data.id}/edit`}>{help.actions.edit}</Link>
              </Button>
            ) : null}
            <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
              {help.actions.delete}
            </Button>
          </>
        ) : published ? (
          <ReportAction
            contentType="news.post"
            contentId={data.id}
            reported={reported.has(data.id)}
          />
        ) : null}
      </div>

      {confirming ? (
        <ConfirmDialog
          {...help.actions.confirmDelete}
          pending={remove.isPending}
          error={remove.error?.message}
          onClose={() => setConfirming(false)}
          onConfirm={() => remove.mutate(data.id, { onSuccess: () => router.push('/news/mine') })}
        />
      ) : null}
    </article>
  );
}

/** /news/[id]: one post, with edit/delete for its author and Report for everyone else. */
export function NewsArticle({ id }: { id: string }) {
  return <LoginGate>{(myId) => <Article id={id} myId={myId} />}</LoginGate>;
}
