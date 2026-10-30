'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDirectory } from '@/features/directory';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';

export type PickedMember = { id: string; name: string };

type MemberPickerProps = {
  id: string;
  selected: PickedMember[];
  onChange: (members: PickedMember[]) => void;
  /** People who cannot be picked, e.g. the viewer and current members. */
  excludeIds: string[];
  max: number;
};

const SEARCH_DELAY_MS = 300;

/** Search-and-tick list of members, backed by the directory search. */
export function MemberPicker({ id, selected, onChange, excludeIds, max }: MemberPickerProps) {
  const features = useFeatures();
  const directoryOn = features.data?.modules.includes('directory') ?? false;
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useDirectory(
    { q, department: '', series: '', role: '' },
    { enabled: directoryOn && q.length > 0 },
  );
  const people = (results.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (person) => !excludeIds.includes(person.id),
  );
  const isSelected = (personId: string) => selected.some((member) => member.id === personId);
  const toggle = (person: PickedMember) =>
    onChange(
      isSelected(person.id)
        ? selected.filter((member) => member.id !== person.id)
        : [...selected, { id: person.id, name: person.name }],
    );

  if (!directoryOn) {
    return <p className="text-sm text-muted-foreground">{help.group.create.needsDirectory}</p>;
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{help.group.create.search}</Label>
      <Input
        id={id}
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
      />
      {selected.length > 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {help.group.create.selected(selected.length)}: {selected.map((m) => m.name).join(', ')}
        </p>
      ) : null}
      {q ? (
        <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-1">
          {results.isPending ? (
            <li className="p-2 text-sm text-muted-foreground">{help.messages.loading}</li>
          ) : people.length === 0 ? (
            <li className="p-2 text-sm text-muted-foreground">{help.group.create.noResults}</li>
          ) : (
            people.map((person) => {
              const checked = isSelected(person.id);
              return (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && selected.length >= max}
                      onChange={() => toggle(person)}
                    />
                    <span className="min-w-0 break-words">{person.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {person.roll}
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
