'use client';

import {
  CAMPUS_PLACES,
  type CampusPlace,
  LOST_FOUND_CATEGORIES,
  type LostFoundCategory,
  type LostFoundKind,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { useBoard, useMyItems } from '../hooks/use-lost-found';
import { ItemGrid } from './ItemGrid';
import { LoginGate } from './LoginGate';

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function Board() {
  const [kind, setKind] = useState<LostFoundKind | undefined>();
  const [category, setCategory] = useState<LostFoundCategory | ''>('');
  const [place, setPlace] = useState<CampusPlace | ''>('');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const board = useBoard({
    kind,
    category: category || undefined,
    place: place || undefined,
    q: q || undefined,
  });
  const labels = help.board;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={help.form.kind} className="flex gap-1">
          {([undefined, 'lost', 'found'] as const).map((option) => (
            <Button
              key={option ?? 'all'}
              size="sm"
              variant={kind === option ? 'default' : 'outline'}
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
            >
              {option ? help.kinds[option] : labels.all}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <InfoTip text={labels.expiryTip} label={labels.expiryTipLabel} />
          <Button asChild size="sm" variant="outline">
            <Link href="/lost-found/mine">{labels.mine}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/lost-found/new">{labels.post}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <Label htmlFor="lf-board-search">{labels.search}</Label>
          <Input
            id="lf-board-search"
            type="search"
            value={text}
            placeholder={labels.searchPlaceholder}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lf-board-category">{labels.category}</Label>
          <select
            id="lf-board-category"
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as LostFoundCategory | '')}
          >
            <option value="">{labels.any}</option>
            {LOST_FOUND_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {help.categories[option]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="lf-board-place">{labels.place}</Label>
          <select
            id="lf-board-place"
            className={selectClass}
            value={place}
            onChange={(e) => setPlace(e.target.value as CampusPlace | '')}
          >
            <option value="">{labels.any}</option>
            {CAMPUS_PLACES.map((option) => (
              <option key={option} value={option}>
                {help.places[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ItemGrid query={board} empty={labels.empty} />
    </div>
  );
}

/** /lost-found: the board of open posts. */
export function LostFoundBoard() {
  return <LoginGate>{() => <Board />}</LoginGate>;
}

function Mine() {
  return <ItemGrid query={useMyItems()} empty={help.mine.empty} showState />;
}

/** /lost-found/mine: the member's own posts in every state. */
export function MyItems() {
  return <LoginGate>{() => <Mine />}</LoginGate>;
}
