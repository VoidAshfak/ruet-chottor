'use client';

import {
  LISTING_CATEGORIES,
  LISTING_SORTS,
  type ListingCategory,
  type ListingSort,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { help } from '../help';
import { useListings, useMyListings } from '../hooks/use-marketplace';
import { ListingGrid } from './ListingGrid';
import { LoginGate } from './LoginGate';

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** Debounced value, so typing in a box does not search on every key. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const toPrice = (text: string) =>
  text.trim() === '' ? undefined : Math.max(0, Math.floor(Number(text)));

function Browse() {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ListingCategory | ''>('');
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState<ListingSort>('newest');
  const q = useDebounced(text.trim());
  const min = useDebounced(minText);
  const max = useDebounced(maxText);

  const minPrice = freeOnly ? undefined : toPrice(min);
  const maxPrice = freeOnly ? 0 : toPrice(max);
  const listings = useListings({
    q: q || undefined,
    category: category || undefined,
    // A reversed range would be rejected; swap it instead of showing an error.
    ...(minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice
      ? { minPrice: maxPrice, maxPrice: minPrice }
      : { minPrice, maxPrice }),
    sort,
  });
  const labels = help.browse;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <InfoTip text={labels.expiryTip} label={labels.expiryTipLabel} />
        <Button asChild size="sm" variant="outline">
          <Link href="/marketplace/mine">{labels.mine}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/marketplace/new">{labels.sell}</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr_1.4fr]">
        <div className="grid gap-1">
          <Label htmlFor="market-search">{labels.search}</Label>
          <Input
            id="market-search"
            type="search"
            value={text}
            placeholder={labels.searchPlaceholder}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="market-category">{labels.category}</Label>
          <select
            id="market-category"
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as ListingCategory | '')}
          >
            <option value="">{labels.any}</option>
            {LISTING_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {help.categories[option]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="market-min">{labels.minPrice}</Label>
          <Input
            id="market-min"
            type="number"
            inputMode="numeric"
            min={0}
            disabled={freeOnly}
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="market-max">{labels.maxPrice}</Label>
          <Input
            id="market-max"
            type="number"
            inputMode="numeric"
            min={0}
            disabled={freeOnly}
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="market-sort">{labels.sort}</Label>
          <select
            id="market-sort"
            className={selectClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as ListingSort)}
          >
            {LISTING_SORTS.map((option) => (
              <option key={option} value={option}>
                {help.sorts[option]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} />
        {labels.freeOnly}
      </label>

      <ListingGrid query={listings} empty={labels.empty} />
    </div>
  );
}

/** /marketplace */
export function MarketBrowse() {
  return <LoginGate>{() => <Browse />}</LoginGate>;
}

function Mine() {
  return <ListingGrid query={useMyListings()} empty={help.mine.empty} showState />;
}

/** /marketplace/mine */
export function MyListings() {
  return <LoginGate>{() => <Mine />}</LoginGate>;
}
