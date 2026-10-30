'use client';

import {
  CAMPUS_PLACES,
  type CampusPlace,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  type Listing,
  type ListingCategory,
  type ListingCondition,
  listingInputSchema,
  MARKETPLACE_LIMITS,
  type MediaAsset,
  PROHIBITED_ITEMS,
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
import { help } from '../help';
import { useListing, useSaveListing } from '../hooks/use-marketplace';
import { LoginGate } from './LoginGate';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm';

type Field = 'title' | 'category' | 'condition' | 'priceTaka' | 'meetPlace' | 'description';

function Form({ existing }: { existing?: Listing }) {
  const router = useRouter();
  const save = useSaveListing(existing?.id);
  const text = help.form;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<ListingCategory | ''>(existing?.category ?? '');
  const [condition, setCondition] = useState<ListingCondition | ''>(existing?.condition ?? '');
  const [price, setPrice] = useState(existing ? String(existing.priceTaka) : '');
  const [meetPlace, setMeetPlace] = useState<CampusPlace | ''>(existing?.meetPlace ?? '');
  const [meetDetail, setMeetDetail] = useState(existing?.meetDetail ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photos, setPhotos] = useState<MediaAsset[]>(existing?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const submit = () => {
    const parsed = listingInputSchema.safeParse({
      title,
      category: category || undefined,
      condition: condition || undefined,
      priceTaka: price.trim() === '' ? undefined : price,
      description,
      meetPlace: meetPlace || undefined,
      meetDetail,
      mediaIds: photos.map((p) => p.id),
    });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    save.mutate(parsed.data, { onSuccess: (listing) => router.push(`/marketplace/${listing.id}`) });
  };

  const error = (field: Field) =>
    errors[field] ? <p className="text-sm text-destructive">{errors[field]}</p> : null;

  return (
    <>
      <PageHeader
        title={existing ? text.editTitle : text.newTitle}
        description={existing ? text.editDescription : text.newDescription}
      />
      <details className="mb-5 rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">{text.rulesTitle}</summary>
        <ul className="mt-2 list-disc pl-5 text-muted-foreground">
          {PROHIBITED_ITEMS.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">{text.rulesNote}</p>
      </details>
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="listing-title">{text.title}</Label>
          <Input
            id="listing-title"
            value={title}
            maxLength={MARKETPLACE_LIMITS.titleMax}
            placeholder={text.titlePlaceholder}
            aria-invalid={errors.title ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {error('title')}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="listing-category">{text.category}</Label>
            <select
              id="listing-category"
              className={`${fieldClass} h-10 py-0`}
              value={category}
              aria-invalid={errors.category ? true : undefined}
              onChange={(e) => setCategory(e.target.value as ListingCategory | '')}
            >
              <option value="">—</option>
              {LISTING_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {help.categories[option]}
                </option>
              ))}
            </select>
            {error('category')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="listing-condition">{text.condition}</Label>
            <select
              id="listing-condition"
              className={`${fieldClass} h-10 py-0`}
              value={condition}
              aria-invalid={errors.condition ? true : undefined}
              onChange={(e) => setCondition(e.target.value as ListingCondition | '')}
            >
              <option value="">—</option>
              {LISTING_CONDITIONS.map((option) => (
                <option key={option} value={option}>
                  {help.conditions[option]}
                </option>
              ))}
            </select>
            {error('condition')}
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="listing-price">{text.price}</Label>
              <InfoTip text={text.priceTip} label={text.priceTipLabel} />
            </div>
            <Input
              id="listing-price"
              type="number"
              inputMode="numeric"
              min={0}
              max={MARKETPLACE_LIMITS.priceMax}
              value={price}
              aria-invalid={errors.priceTaka ? true : undefined}
              onChange={(e) => setPrice(e.target.value)}
            />
            {error('priceTaka')}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="listing-meet">{text.meetPlace}</Label>
            <select
              id="listing-meet"
              className={`${fieldClass} h-10 py-0`}
              value={meetPlace}
              aria-invalid={errors.meetPlace ? true : undefined}
              onChange={(e) => setMeetPlace(e.target.value as CampusPlace | '')}
            >
              <option value="">—</option>
              {CAMPUS_PLACES.map((option) => (
                <option key={option} value={option}>
                  {help.places[option]}
                </option>
              ))}
            </select>
            {error('meetPlace')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="listing-meet-detail">{text.meetDetail}</Label>
            <Input
              id="listing-meet-detail"
              value={meetDetail}
              maxLength={MARKETPLACE_LIMITS.meetDetailMax}
              placeholder={text.meetDetailPlaceholder}
              onChange={(e) => setMeetDetail(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="listing-description">{text.description}</Label>
          <textarea
            id="listing-description"
            rows={5}
            value={description}
            maxLength={MARKETPLACE_LIMITS.descriptionMax}
            placeholder={text.descriptionPlaceholder}
            className={fieldClass}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error('description')}
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{text.photos}</span>
          <MediaUploader
            purpose="marketplace.listing"
            value={photos}
            onChange={setPhotos}
            onBusyChange={setUploading}
          />
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
                  : text.post}
          </Button>
          <Button asChild variant="outline">
            <Link href={existing ? `/marketplace/${existing.id}` : '/marketplace'}>
              {text.cancel}
            </Link>
          </Button>
        </div>
      </form>
    </>
  );
}

function Edit({ id }: { id: string }) {
  const listing = useListing(id);
  if (listing.isPending) {
    return <RuetLoader className="min-h-64" />;
  }
  if (listing.isError || !listing.data.isMine) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.form.notYours}</p>;
  }
  return <Form existing={listing.data} />;
}

/** /marketplace/new and /marketplace/[id]/edit. */
export function ListingForm({ id }: { id?: string }) {
  return <LoginGate>{() => (id ? <Edit id={id} /> : <Form />)}</LoginGate>;
}
