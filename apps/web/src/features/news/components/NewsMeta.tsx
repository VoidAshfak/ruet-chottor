import {
  formatDateTime,
  NEWS_VERIFIED_ROLES,
  type NewsPost,
  type Role,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { InfoTip } from '@/components/guide/InfoTip';
import { help } from '../help';

/** Category · author (with "Verified") · date. */
export function NewsMeta({ post }: { post: NewsPost }) {
  const verified =
    post.author && (NEWS_VERIFIED_ROLES as readonly Role[]).includes(post.author.role);
  const date = post.publishedAt ?? post.createdAt;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
        {help.categories[post.category]}
      </span>
      <span>{help.feed.by(post.author?.name ?? help.feed.unknownAuthor)}</span>
      {post.club ? (
        <span>
          {help.feed.forClub}{' '}
          <Link href={`/clubs/${post.club.slug}`} className="text-primary hover:underline">
            {post.club.name}
          </Link>
        </span>
      ) : null}
      {verified ? (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
          {help.feed.verified}
          <InfoTip text={help.feed.verifiedTip} label={help.feed.verifiedTipLabel} />
        </span>
      ) : null}
      <span aria-hidden>·</span>
      <time dateTime={date}>{formatDateTime(date)}</time>
    </p>
  );
}
