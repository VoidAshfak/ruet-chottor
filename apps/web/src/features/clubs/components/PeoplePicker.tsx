'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDirectory } from '@/features/directory';
import { useFeatures } from '@/lib/use-features';
import { help } from '../help';

export type Picked = { id: string; name: string };

/** Search-and-tick list of members (directory search), for choosing club managers. */
export function PeoplePicker({
  id,
  selected,
  onChange,
  max,
}: {
  id: string;
  selected: Picked[];
  onChange: (people: Picked[]) => void;
  max: number;
}) {
  const directoryOn = useFeatures().data?.modules.includes('directory') ?? false;
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const results = useDirectory(
    { q, department: '', series: '', role: '' },
    { enabled: directoryOn && q.length > 0 },
  );
  const people = results.data?.pages.flatMap((page) => page.items) ?? [];
  const isSelected = (personId: string) => selected.some((p) => p.id === personId);

  if (!directoryOn)
    return <p className="text-sm text-muted-foreground">{help.admin.needsDirectory}</p>;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{help.admin.searchPeople}</Label>
      <Input
        id={id}
        type="search"
        value={text}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      {selected.length > 0 ? (
        <p className="text-sm" aria-live="polite">
          {selected.map((p) => p.name).join(', ')}
        </p>
      ) : null}
      {q ? (
        <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-1">
          {people.length === 0 ? (
            <li className="p-2 text-sm text-muted-foreground">{help.admin.noPeople}</li>
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
                      onChange={() =>
                        onChange(
                          checked
                            ? selected.filter((p) => p.id !== person.id)
                            : [...selected, { id: person.id, name: person.name }],
                        )
                      }
                    />
                    <span className="min-w-0 break-words">{person.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{person.roll}</span>
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
