'use client';

import {
  CLUB_CATEGORIES,
  CLUB_LIMITS,
  type ClubCategory,
  type ClubSummary,
  createClubRequestSchema,
} from '@ruet-chottor/shared';
import Link from 'next/link';
import { useState } from 'react';
import { FormError } from '@/components/form/FormError';
import { InfoTip } from '@/components/guide/InfoTip';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from '@/features/auth';
import { help } from '../help';
import { useClub, useClubActions, useClubs, useCreateClub } from '../hooks/use-clubs';
import { type Picked, PeoplePicker } from './PeoplePicker';

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm';

function CreateDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateClub();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<ClubCategory | ''>('');
  const [managers, setManagers] = useState<Picked[]>([]);
  const [error, setError] = useState<string>();
  const text = help.admin;

  const submit = () => {
    const parsed = createClubRequestSchema.safeParse({
      name,
      tagline,
      category: category || undefined,
      about: '',
      managerIds: managers.map((m) => m.id),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    create.mutate(parsed.data, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>{text.createTitle}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="new-club-name">{help.editor.name}</Label>
            <Input
              id="new-club-name"
              value={name}
              maxLength={CLUB_LIMITS.nameMax}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-club-tagline">{help.editor.tagline}</Label>
            <Input
              id="new-club-tagline"
              value={tagline}
              maxLength={CLUB_LIMITS.taglineMax}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-club-category">{help.editor.category}</Label>
            <select
              id="new-club-category"
              className={`${fieldClass} h-10 py-0`}
              value={category}
              onChange={(e) => setCategory(e.target.value as ClubCategory | '')}
            >
              <option value="">—</option>
              {CLUB_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {help.categories[option]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{text.managers}</span>
              <InfoTip text={text.managersTip} label={text.managersTipLabel} />
            </div>
            <PeoplePicker
              id="new-club-managers"
              selected={managers}
              onChange={setManagers}
              max={CLUB_LIMITS.managers}
            />
          </div>
          <FormError message={error ?? create.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={onClose}>
              {text.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {text.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManagersDialog({ club, onClose }: { club: ClubSummary; onClose: () => void }) {
  const detail = useClub(club.slug);
  const actions = useClubActions(club.id);
  const [managers, setManagers] = useState<Picked[] | null>(null);
  const current = managers ?? detail.data?.managers.map((m) => ({ id: m.id, name: m.name })) ?? [];
  const text = help.admin;

  return (
    <Dialog open onOpenChange={(open) => !open && !actions.setManagers.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>
          {text.changeManagers}: {club.name}
        </DialogTitle>
        <DialogDescription>{text.managersTip}</DialogDescription>
        <PeoplePicker
          id="club-managers"
          selected={current}
          onChange={setManagers}
          max={CLUB_LIMITS.managers}
        />
        <FormError message={actions.setManagers.error?.message} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {text.cancel}
          </Button>
          <Button
            disabled={actions.setManagers.isPending || current.length === 0}
            onClick={() =>
              actions.setManagers.mutate(
                current.map((m) => m.id),
                { onSuccess: onClose },
              )
            }
          >
            {text.saveManagers}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** /admin/clubs (admins only; the API checks too): create clubs and change their managers. */
export function AdminClubs() {
  const session = useSession();
  if (session.user?.role !== 'admin') {
    return <p className="rounded-lg border p-6 text-muted-foreground">{help.admin.adminOnly}</p>;
  }
  return <ClubsAdmin />;
}

function ClubsAdmin() {
  const clubs = useClubs({ q: '' });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClubSummary | null>(null);
  const items = clubs.data?.pages.flatMap((page) => page.items) ?? [];
  const text = help.admin;

  return (
    <div className="grid gap-4">
      <div>
        <Button size="sm" onClick={() => setCreating(true)}>
          {text.create}
        </Button>
      </div>
      {clubs.isPending ? (
        <p role="status" className="text-muted-foreground">
          {help.list.loading}
        </p>
      ) : clubs.isError ? (
        <p role="alert" className="text-destructive">
          {clubs.error.message}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-muted-foreground">{help.list.empty}</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((club) => (
            <li key={club.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <span className="min-w-0 flex-1 break-words">
                <span className="font-medium">{club.name}</span>{' '}
                <span className="text-sm text-muted-foreground">
                  · {help.categories[club.category]} · {help.list.members(club.memberCount)}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => setEditing(club)}>
                {text.changeManagers}
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/clubs/${club.slug}`}>{text.open}</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {creating ? <CreateDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <ManagersDialog club={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
