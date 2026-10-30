'use client';

import {
  CAMPUS_PLACES,
  type CampusPlace,
  dhakaDateKey,
  LOST_FOUND_CATEGORIES,
  LOST_FOUND_LIMITS,
  type LostFoundCategory,
  lostFoundInputSchema,
  type LostFoundItem,
  type LostFoundKind,
  type MediaAsset,
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
import { useItem, useSaveItem } from '../hooks/use-lost-found';
import { LoginGate } from './LoginGate';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm';

type Field =
  | 'kind'
  | 'category'
  | 'title'
  | 'place'
  | 'placeDetail'
  | 'happenedOn'
  | 'verifyQuestion'
  | 'description';

function Form({ existing }: { existing?: LostFoundItem }) {
  const router = useRouter();
  const save = useSaveItem(existing?.id);
  const text = help.form;
  const [kind, setKind] = useState<LostFoundKind>(existing?.kind ?? 'lost');
  const [category, setCategory] = useState<LostFoundCategory | ''>(existing?.category ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [place, setPlace] = useState<CampusPlace | ''>(existing?.place ?? '');
  const [placeDetail, setPlaceDetail] = useState(existing?.placeDetail ?? '');
  // Today in Dhaka; this form renders in the browser only (inside LoginGate).
  const [happenedOn, setHappenedOn] = useState(existing?.happenedOn ?? dhakaDateKey(new Date()));
  const [description, setDescription] = useState(existing?.description ?? '');
  const [verifyQuestion, setVerifyQuestion] = useState(existing?.verifyQuestion ?? '');
  const [photos, setPhotos] = useState<MediaAsset[]>(existing?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const submit = () => {
    const parsed = lostFoundInputSchema.safeParse({
      kind,
      category: category || undefined,
      title,
      description,
      place: place || undefined,
      placeDetail,
      happenedOn,
      verifyQuestion: kind === 'found' ? verifyQuestion : '',
      mediaIds: photos.map((p) => p.id),
    });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    save.mutate(parsed.data, { onSuccess: (item) => router.push(`/lost-found/${item.id}`) });
  };

  const error = (field: Field) =>
    errors[field] ? <p className="text-sm text-destructive">{errors[field]}</p> : null;

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
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{text.kind}</legend>
          <div className="flex gap-2">
            {(['lost', 'found'] as const).map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
              >
                <input
                  type="radio"
                  name="lf-kind"
                  value={option}
                  checked={kind === option}
                  onChange={() => setKind(option)}
                />
                {option === 'lost' ? text.lostOption : text.foundOption}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="lf-category">{text.category}</Label>
            <select
              id="lf-category"
              className={`${fieldClass} h-10 py-0`}
              value={category}
              aria-invalid={errors.category ? true : undefined}
              onChange={(e) => setCategory(e.target.value as LostFoundCategory | '')}
            >
              <option value="">—</option>
              {LOST_FOUND_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {help.categories[option]}
                </option>
              ))}
            </select>
            {error('category')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lf-date">{text.happenedOn}</Label>
            <Input
              id="lf-date"
              type="date"
              value={happenedOn}
              max={dhakaDateKey(new Date())}
              aria-invalid={errors.happenedOn ? true : undefined}
              onChange={(e) => setHappenedOn(e.target.value)}
            />
            {error('happenedOn')}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="lf-title">{text.title}</Label>
          <Input
            id="lf-title"
            value={title}
            maxLength={LOST_FOUND_LIMITS.titleMax}
            placeholder={text.titlePlaceholder}
            aria-invalid={errors.title ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {error('title')}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="lf-place">{text.place}</Label>
            <select
              id="lf-place"
              className={`${fieldClass} h-10 py-0`}
              value={place}
              aria-invalid={errors.place ? true : undefined}
              onChange={(e) => setPlace(e.target.value as CampusPlace | '')}
            >
              <option value="">—</option>
              {CAMPUS_PLACES.map((option) => (
                <option key={option} value={option}>
                  {help.places[option]}
                </option>
              ))}
            </select>
            {error('place')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lf-place-detail">{text.placeDetail}</Label>
            <Input
              id="lf-place-detail"
              value={placeDetail}
              maxLength={LOST_FOUND_LIMITS.placeDetailMax}
              placeholder={text.placeDetailPlaceholder}
              onChange={(e) => setPlaceDetail(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="lf-description">{text.description}</Label>
            {kind === 'found' ? (
              <InfoTip text={text.foundDescriptionTip} label={text.foundDescriptionTipLabel} />
            ) : null}
          </div>
          <textarea
            id="lf-description"
            rows={5}
            value={description}
            maxLength={LOST_FOUND_LIMITS.descriptionMax}
            placeholder={text.descriptionPlaceholder}
            className={fieldClass}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error('description')}
        </div>

        {kind === 'found' ? (
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="lf-question">{text.verifyQuestion}</Label>
              <InfoTip text={text.verifyTip} label={text.verifyTipLabel} />
            </div>
            <Input
              id="lf-question"
              value={verifyQuestion}
              maxLength={LOST_FOUND_LIMITS.questionMax}
              placeholder={text.verifyPlaceholder}
              onChange={(e) => setVerifyQuestion(e.target.value)}
            />
            {error('verifyQuestion')}
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{text.photos}</span>
            {kind === 'found' ? (
              <InfoTip text={text.foundPhotoTip} label={text.foundPhotoTipLabel} />
            ) : null}
          </div>
          <MediaUploader
            purpose="lost-found.item"
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
            <Link href={existing ? `/lost-found/${existing.id}` : '/lost-found'}>
              {text.cancel}
            </Link>
          </Button>
        </div>
      </form>
    </>
  );
}

function Edit({ id }: { id: string }) {
  const item = useItem(id);
  if (item.isPending) {
    return <RuetLoader className="min-h-64" />;
  }
  if (item.isError || !item.data.isMine) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.form.notYours}</p>;
  }
  return <Form existing={item.data} />;
}

/** /lost-found/new and /lost-found/[id]/edit. */
export function ItemForm({ id }: { id?: string }) {
  return <LoginGate>{() => (id ? <Edit id={id} /> : <Form />)}</LoginGate>;
}
