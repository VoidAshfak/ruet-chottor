'use client';

import {
  type MediaAsset,
  NEWS_CATEGORIES,
  NEWS_LIMITS,
  NEWS_VERIFIED_ROLES,
  type NewsCategory,
  type NewsPost,
  newsPostInputSchema,
  type Role,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RuetLoader } from '@/components/art/RuetLoader';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { PageHeader } from '@/components/guide/PageHeader';
import { MediaUploader } from '@/components/media/MediaUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/features/auth';
import { useManagedClubs } from '@/features/clubs';
import { help } from '../help';
import { useNewsPost, useSaveNews } from '../hooks/use-news';
import { LoginGate } from './LoginGate';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm';

type Errors = Partial<Record<'title' | 'category' | 'body' | 'mediaIds', string>>;

function Form({ existing }: { existing?: NewsPost }) {
  const router = useRouter();
  const session = useSession();
  const save = useSaveNews(existing?.id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<NewsCategory | ''>(existing?.category ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [media, setMedia] = useState<MediaAsset[]>(existing?.media ?? []);
  const [uploading, setUploading] = useState(false);
  const managedClubs = useManagedClubs({ enabled: !!session.user });
  const [clubId, setClubId] = useState(existing?.club?.id ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const text = help.editor;
  const verified = (NEWS_VERIFIED_ROLES as readonly Role[]).includes(
    session.user?.role ?? 'student',
  );

  const submit = () => {
    const parsed = newsPostInputSchema.safeParse({
      title,
      category: category || undefined,
      body,
      mediaIds: media.map((m) => m.id),
      clubId: clubId || null,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Errors;
        next[field] ??= issue.message;
      }
      return setErrors(next);
    }
    setErrors({});
    save.mutate(parsed.data, { onSuccess: (post) => router.push(`/news/${post.id}`) });
  };

  return (
    <>
      <PageHeader
        title={existing ? text.editTitle : text.newTitle}
        description={existing ? text.editDescription : text.newDescription}
      />
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="flex items-center gap-1 rounded-md bg-muted px-3 py-2 text-sm">
          {verified ? text.verifiedNote : text.reviewNote}
          {verified ? null : <InfoTip text={text.reviewNote} label={text.reviewTipLabel} />}
        </p>

        {managedClubs.length > 0 ? (
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="news-club">{text.postAs}</Label>
              <InfoTip text={text.postAsTip} label={text.postAsTipLabel} />
            </div>
            <select
              id="news-club"
              className={`${fieldClass} h-10 py-0`}
              value={clubId}
              onChange={(event) => setClubId(event.target.value)}
            >
              <option value="">{text.postAsMe}</option>
              {managedClubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="news-title">{text.title}</Label>
          <Input
            id="news-title"
            value={title}
            maxLength={NEWS_LIMITS.titleMax}
            placeholder={text.titlePlaceholder}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'news-title-error' : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title ? (
            <p id="news-title-error" className="text-sm text-destructive">
              {errors.title}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="news-category">{text.category}</Label>
          <select
            id="news-category"
            className={`${fieldClass} h-10 py-0`}
            value={category}
            aria-invalid={errors.category ? true : undefined}
            onChange={(event) => setCategory(event.target.value as NewsCategory | '')}
          >
            <option value="">{text.categoryPlaceholder}</option>
            {NEWS_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {help.categories[option]}
              </option>
            ))}
          </select>
          {errors.category ? <p className="text-sm text-destructive">{errors.category}</p> : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="news-body">{text.body}</Label>
          <textarea
            id="news-body"
            rows={10}
            value={body}
            maxLength={NEWS_LIMITS.bodyMax}
            placeholder={text.bodyPlaceholder}
            className={fieldClass}
            aria-invalid={errors.body ? true : undefined}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex justify-between text-sm">
            <span className="text-destructive">{errors.body}</span>
            <span className="text-muted-foreground">{text.counter(body.length)}</span>
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{text.media}</span>
          <MediaUploader
            purpose="news.post"
            value={media}
            onChange={setMedia}
            onBusyChange={setUploading}
          />
          {errors.mediaIds ? <p className="text-sm text-destructive">{errors.mediaIds}</p> : null}
        </div>

        <FormError message={save.error?.message} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={save.isPending || uploading}>
            {save.isPending
              ? text.saving
              : uploading
                ? text.waitUploads
                : existing
                  ? text.save
                  : verified
                    ? text.publish
                    : text.submitForReview}
          </Button>
          <Button asChild variant="outline">
            <Link href={existing ? `/news/${existing.id}` : '/news'}>{text.cancel}</Link>
          </Button>
        </div>
      </form>
    </>
  );
}

function Edit({ id, myId }: { id: string; myId: string }) {
  const post = useNewsPost(id, { enabled: true });
  if (post.isPending) {
    return <RuetLoader className="min-h-64" />;
  }
  // Someone else's post looks the same as a missing one.
  if (post.isError || post.data.author?.id !== myId) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.notFound}</p>;
  }
  return <Form existing={post.data} />;
}

/** /news/new and /news/[id]/edit. */
export function NewsEditor({ id }: { id?: string }) {
  return <LoginGate>{(myId) => (id ? <Edit id={id} myId={myId} /> : <Form />)}</LoginGate>;
}
