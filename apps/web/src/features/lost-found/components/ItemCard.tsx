import type { LostFoundItem } from '@ruet-chottor/shared';
import Link from 'next/link';
import { help } from '../help';
import { ItemPhoto } from './ItemPhoto';

/** "2026-10-28" -> "28 Oct 2026". The day is stored as a calendar date, so no time zone shift. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/** One post on the board. Lost posts are marked in the accent colour, found posts in green. */
export function ItemCard({
  item,
  showState = false,
}: {
  item: LostFoundItem;
  showState?: boolean;
}) {
  const photo = item.photos[0];
  return (
    <li className="overflow-hidden rounded-lg border">
      <Link href={`/lost-found/${item.id}`} className="grid gap-2 p-3 hover:bg-accent/50">
        {photo ? (
          <ItemPhoto
            photo={photo}
            blurred={item.kind === 'found' && !item.isMine}
            alt={item.title}
            thumbnail
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${
              item.kind === 'lost'
                ? 'bg-accent text-accent-foreground'
                : 'bg-brand-green text-primary-foreground'
            }`}
          >
            {help.kinds[item.kind]}
          </span>
          <span className="text-muted-foreground">{help.categories[item.category]}</span>
          {showState && (item.state !== 'open' || item.expired) ? (
            <span className="rounded-full border px-2 py-0.5 text-muted-foreground">
              {item.expired ? help.board.expiredLabel : help.states[item.state]}
            </span>
          ) : null}
        </div>
        <span className="font-medium break-words">{item.title}</span>
        <span className="text-sm text-muted-foreground">
          {help.places[item.place]} · {help.board.on(formatDay(item.happenedOn))}
        </span>
      </Link>
    </li>
  );
}
