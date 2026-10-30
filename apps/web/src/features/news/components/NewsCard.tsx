import { NEWS_LIMITS, type NewsPost } from '@ruet-chottor/shared';
import Link from 'next/link';
import { help } from '../help';
import { NewsMeta } from './NewsMeta';
import { ReviewBadge } from './ReviewBadge';

function excerpt(body: string): string {
  return body.length > NEWS_LIMITS.excerpt
    ? `${body.slice(0, NEWS_LIMITS.excerpt).trimEnd()}…`
    : body;
}

/** One post in a list. The title links to the full post. */
export function NewsCard({ post, showReview = false }: { post: NewsPost; showReview?: boolean }) {
  const cover = post.media[0];
  return (
    <li className="overflow-hidden rounded-lg border">
      {cover?.thumbnailUrl ? (
        // Cloudinary serves a small optimised thumbnail; next/image would resize it again on our server.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover.thumbnailUrl}
          alt=""
          loading="lazy"
          className="aspect-[3/1] w-full bg-muted object-cover"
        />
      ) : null}
      <div className="grid gap-2 p-4">
        <h2 className="text-lg font-semibold break-words">
          <Link href={`/news/${post.id}`} className="hover:underline">
            {post.title}
          </Link>
        </h2>
        <NewsMeta post={post} />
        {showReview ? <ReviewBadge post={post} /> : null}
        <p className="break-words whitespace-pre-line text-muted-foreground">
          {excerpt(post.body)}
        </p>
        <Link href={`/news/${post.id}`} className="text-sm text-primary hover:underline">
          {help.feed.readMore}
          <span className="sr-only">: {post.title}</span>
        </Link>
      </div>
    </li>
  );
}
