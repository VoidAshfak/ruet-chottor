'use client';

import {
  CLUB_CATEGORIES,
  CLUB_LIMITS,
  type ClubCategory,
  type ClubDetail,
  type ClubLink,
  type MediaAsset,
  updateClubRequestSchema,
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
import { help } from '../help';
import { useClub, useClubActions } from '../hooks/use-clubs';
import { LoginGate } from './LoginGate';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

function Form({ club, isAdmin }: { club: ClubDetail; isAdmin: boolean }) {
  const router = useRouter();
  const actions = useClubActions(club.id);
  const text = help.editor;
  const [name, setName] = useState(club.name);
  const [tagline, setTagline] = useState(club.tagline);
  const [category, setCategory] = useState<ClubCategory>(club.category);
  const [about, setAbout] = useState(club.about);
  const [contactEmail, setContactEmail] = useState(club.contactEmail ?? '');
  const [links, setLinks] = useState<ClubLink[]>(club.links);
  const [logo, setLogo] = useState<MediaAsset[]>(club.logo ? [club.logo] : []);
  const [cover, setCover] = useState<MediaAsset[]>(club.cover ? [club.cover] : []);
  const [busy, setBusy] = useState({ logo: false, cover: false });
  const [error, setError] = useState<string>();
  const uploading = busy.logo || busy.cover;

  const submit = () => {
    const parsed = updateClubRequestSchema.safeParse({
      ...(isAdmin ? { name } : {}),
      tagline,
      category,
      about,
      contactEmail,
      links,
      logoId: logo[0]?.id ?? null,
      coverId: cover[0]?.id ?? null,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setError(issue ? `${issue.path.join(' ')}: ${issue.message}` : undefined);
    }
    setError(undefined);
    actions.update.mutate(parsed.data, {
      onSuccess: (updated) => router.push(`/clubs/${updated.slug}`),
    });
  };

  return (
    <>
      <PageHeader title={text.title} description={text.description} />
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="club-name">{text.name}</Label>
          <Input
            id="club-name"
            value={name}
            disabled={!isAdmin}
            maxLength={CLUB_LIMITS.nameMax}
            onChange={(event) => setName(event.target.value)}
          />
          {isAdmin ? null : <p className="text-xs text-muted-foreground">{text.nameAdminOnly}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="club-tagline">{text.tagline}</Label>
          <Input
            id="club-tagline"
            value={tagline}
            maxLength={CLUB_LIMITS.taglineMax}
            onChange={(event) => setTagline(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="club-category">{text.category}</Label>
          <select
            id="club-category"
            className={`${fieldClass} h-10 py-0`}
            value={category}
            onChange={(event) => setCategory(event.target.value as ClubCategory)}
          >
            {CLUB_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {help.categories[option]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="club-about">{text.about}</Label>
          <textarea
            id="club-about"
            rows={8}
            value={about}
            maxLength={CLUB_LIMITS.aboutMax}
            placeholder={text.aboutPlaceholder}
            className={fieldClass}
            onChange={(event) => setAbout(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor="club-email">{text.contactEmail}</Label>
            <InfoTip text={text.contactTip} label={text.contactTipLabel} />
          </div>
          <Input
            id="club-email"
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{text.links}</legend>
          {links.map((link, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                aria-label={`${text.linkLabel} ${index + 1}`}
                placeholder={text.linkLabel}
                value={link.label}
                onChange={(event) =>
                  setLinks(
                    links.map((l, i) => (i === index ? { ...l, label: event.target.value } : l)),
                  )
                }
              />
              <Input
                aria-label={`${text.linkUrl} ${index + 1}`}
                placeholder="https://"
                type="url"
                value={link.url}
                onChange={(event) =>
                  setLinks(
                    links.map((l, i) => (i === index ? { ...l, url: event.target.value } : l)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLinks(links.filter((_, i) => i !== index))}
              >
                {text.removeLink}
              </Button>
            </div>
          ))}
          {links.length < CLUB_LIMITS.links ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setLinks([...links, { label: '', url: '' }])}
            >
              {text.addLink}
            </Button>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{text.logo}</span>
            <MediaUploader
              purpose="clubs.logo"
              value={logo}
              onChange={setLogo}
              onBusyChange={(value) => setBusy((b) => ({ ...b, logo: value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{text.cover}</span>
            <MediaUploader
              purpose="clubs.cover"
              value={cover}
              onChange={setCover}
              onBusyChange={(value) => setBusy((b) => ({ ...b, cover: value }))}
            />
          </div>
        </div>

        <FormError message={error ?? actions.update.error?.message} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={actions.update.isPending || uploading}>
            {actions.update.isPending ? text.saving : uploading ? text.waitUploads : text.save}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/clubs/${club.slug}`}>{text.cancel}</Link>
          </Button>
        </div>
      </form>
    </>
  );
}

function Edit({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const club = useClub(slug);
  if (club.isPending) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted" aria-hidden />;
  }
  if (club.isError || !club.data.canEdit) {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.editor.notAllowed}</p>;
  }
  return <Form club={club.data} isAdmin={isAdmin} />;
}

/** /clubs/[slug]/edit, for the club's managers and admins (the API checks too). */
export function ClubEditor({ slug }: { slug: string }) {
  return <LoginGate>{(user) => <Edit slug={slug} isAdmin={user.role === 'admin'} />}</LoginGate>;
}
