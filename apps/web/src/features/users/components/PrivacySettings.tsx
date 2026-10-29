'use client';

import type { MyProfile } from '@ruet-chottor/shared';
import { useState } from 'react';
import { InfoTip } from '@/components/guide/InfoTip';
import { FormError } from '@/components/form/FormError';
import { help } from '../help';
import { useUpdateMyProfile } from '../hooks/use-my-profile';

type Setting = 'showEmail' | 'showPhone';

const SETTINGS: { key: Setting; label: string; tip: string }[] = [
  { key: 'showEmail', label: help.privacy.showEmail, tip: help.tips.showEmail },
  { key: 'showPhone', label: help.privacy.showPhone, tip: help.tips.showPhone },
];

/** Each switch saves as soon as it changes. */
export function PrivacySettings({ profile }: { profile: MyProfile }) {
  const update = useUpdateMyProfile();
  // Set in the same click, so the box never flips back while the request is in flight.
  const [optimistic, setOptimistic] = useState<Partial<Record<Setting, boolean>>>({});

  const change = (key: Setting, value: boolean) => {
    setOptimistic({ [key]: value });
    update.mutate({ [key]: value }, { onSettled: () => setOptimistic({}) });
  };

  return (
    <section className="rounded-lg border p-4 sm:p-6" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" className="text-lg font-semibold">
        {help.privacy.heading}
      </h2>
      <ul className="mt-3 grid gap-3">
        {SETTINGS.map((setting) => (
          <li key={setting.key} className="flex items-center gap-3">
            <input
              id={setting.key}
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={optimistic[setting.key] ?? profile[setting.key]}
              disabled={update.isPending}
              onChange={(event) => change(setting.key, event.target.checked)}
            />
            <label htmlFor={setting.key} className="text-sm">
              {setting.label}
            </label>
            <InfoTip text={setting.tip} label={`About: ${setting.label.toLowerCase()}`} />
          </li>
        ))}
      </ul>
      <p role="status" className="mt-3 min-h-5 text-sm text-muted-foreground">
        {update.isPending ? help.privacy.saving : update.isSuccess ? help.privacy.saved : null}
      </p>
      <FormError message={update.error?.message} />
    </section>
  );
}
