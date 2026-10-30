'use client';

import {
  type CampusEvent,
  EVENT_CATEGORIES,
  EVENT_LIMITS,
  type EventCategory,
  eventInputSchema,
  fromDhakaLocal,
  type MediaAsset,
  STAFF_ROLES,
  toDhakaLocal,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { PageHeader } from '@/components/guide/PageHeader';
import { MediaUploader } from '@/components/media/MediaUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useManagedClubs } from '@/features/clubs';
import { help } from '../help';
import { useEvent, useSaveEvent } from '../hooks/use-events';
import { LoginGate } from './LoginGate';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm';

type Field =
  'title' | 'category' | 'startsAt' | 'endsAt' | 'venue' | 'clubId' | 'capacity' | 'description';

function Form({ existing, isStaff }: { existing?: CampusEvent; isStaff: boolean }) {
  const router = useRouter();
  const save = useSaveEvent(existing?.id);
  const managed = useManagedClubs({ enabled: true });
  const text = help.form;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<EventCategory | ''>(existing?.category ?? '');
  const [clubId, setClubId] = useState(
    existing?.club?.id ?? (isStaff ? '' : (managed[0]?.id ?? '')),
  );
  const [startsAt, setStartsAt] = useState(existing ? toDhakaLocal(existing.startsAt) : '');
  const [endsAt, setEndsAt] = useState(existing ? toDhakaLocal(existing.endsAt) : '');
  const [venue, setVenue] = useState(existing?.venue ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [capacity, setCapacity] = useState(existing?.capacity ? String(existing.capacity) : '');
  const [poster, setPoster] = useState<MediaAsset[]>(existing?.poster ? [existing.poster] : []);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  // A club manager who has not picked yet gets their first club (the hook loads after the form).
  const organiser = clubId || (isStaff ? '' : (managed[0]?.id ?? ''));
  const clubs =
    existing?.club && !managed.some((c) => c.id === existing.club?.id)
      ? [...managed, { id: existing.club.id, name: existing.club.name }]
      : managed;

  const submit = () => {
    const parsed = eventInputSchema.safeParse({
      title,
      category: category || undefined,
      description,
      venue,
      startsAt: startsAt ? fromDhakaLocal(startsAt) : '',
      endsAt: endsAt ? fromDhakaLocal(endsAt) : '',
      clubId: organiser,
      capacity,
      posterId: poster[0]?.id ?? null,
    });
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      return setErrors(next);
    }
    setErrors({});
    save.mutate(parsed.data, { onSuccess: (event) => router.push(`/events/${event.id}`) });
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
        <div className="grid gap-1.5">
          <Label htmlFor="event-title">{text.title}</Label>
          <Input
            id="event-title"
            value={title}
            maxLength={EVENT_LIMITS.titleMax}
            placeholder={text.titlePlaceholder}
            aria-invalid={errors.title ? true : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {error('title')}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="event-category">{text.category}</Label>
            <select
              id="event-category"
              className={`${fieldClass} h-10 py-0`}
              value={category}
              aria-invalid={errors.category ? true : undefined}
              onChange={(e) => setCategory(e.target.value as EventCategory | '')}
            >
              <option value="">—</option>
              {EVENT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {help.categories[option]}
                </option>
              ))}
            </select>
            {error('category')}
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="event-organiser">{text.organiser}</Label>
              <InfoTip text={text.organiserTip} label={text.organiserTipLabel} />
            </div>
            <select
              id="event-organiser"
              className={`${fieldClass} h-10 py-0`}
              value={organiser}
              onChange={(e) => setClubId(e.target.value)}
            >
              {isStaff ? <option value="">{text.campusWide}</option> : null}
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            {error('clubId')}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="event-start">{text.startsAt}</Label>
              <InfoTip text={text.timeTip} label={text.timeTipLabel} />
            </div>
            <Input
              id="event-start"
              type="datetime-local"
              value={startsAt}
              aria-invalid={errors.startsAt ? true : undefined}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            {error('startsAt')}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-end">{text.endsAt}</Label>
            <Input
              id="event-end"
              type="datetime-local"
              value={endsAt}
              min={startsAt || undefined}
              aria-invalid={errors.endsAt ? true : undefined}
              onChange={(e) => setEndsAt(e.target.value)}
            />
            {error('endsAt')}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="event-venue">{text.venue}</Label>
          <Input
            id="event-venue"
            value={venue}
            maxLength={EVENT_LIMITS.venueMax}
            placeholder={text.venuePlaceholder}
            aria-invalid={errors.venue ? true : undefined}
            onChange={(e) => setVenue(e.target.value)}
          />
          {error('venue')}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="event-description">{text.description}</Label>
          <textarea
            id="event-description"
            rows={6}
            value={description}
            maxLength={EVENT_LIMITS.descriptionMax}
            placeholder={text.descriptionPlaceholder}
            className={fieldClass}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error('description')}
        </div>

        <div className="grid gap-1.5 sm:max-w-48">
          <div className="flex items-center gap-1">
            <Label htmlFor="event-capacity">{text.capacity}</Label>
            <InfoTip text={text.capacityTip} label={text.capacityTipLabel} />
          </div>
          <Input
            id="event-capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={EVENT_LIMITS.capacityMax}
            value={capacity}
            aria-invalid={errors.capacity ? true : undefined}
            onChange={(e) => setCapacity(e.target.value)}
          />
          {error('capacity')}
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium">{text.poster}</span>
          <MediaUploader
            purpose="events.poster"
            value={poster}
            onChange={setPoster}
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
                  : text.create}
          </Button>
          <Button asChild variant="outline">
            <Link href={existing ? `/events/${existing.id}` : '/events'}>{text.back}</Link>
          </Button>
        </div>
      </form>
    </>
  );
}

function Gate({ id, role }: { id?: string; role: string }) {
  const isStaff = (STAFF_ROLES as readonly string[]).includes(role);
  const managed = useManagedClubs({ enabled: true });
  const event = useEvent(id ?? '', { enabled: !!id });
  if (id) {
    if (event.isPending) {
      return <div className="h-64 animate-pulse rounded-lg border bg-muted" aria-hidden />;
    }
    if (event.isError || !event.data.canEdit) {
      return <p className="rounded-lg border p-6 text-muted-foreground">{help.form.notEditable}</p>;
    }
    return <Form existing={event.data} isStaff={isStaff} />;
  }
  if (!isStaff && managed.length === 0) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.form.notAllowed}</p>;
  }
  return <Form isStaff={isStaff} />;
}

/** /events/new and /events/[id]/edit. The API checks who may organise, too. */
export function EventForm({ id }: { id?: string }) {
  return <LoginGate>{(user) => <Gate id={id} role={user.role} />}</LoginGate>;
}
