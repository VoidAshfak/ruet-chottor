'use client';

import { type ReactNode, useMemo } from 'react';
import { type GuideSync, GuideSyncContext } from '@/components/guide/guide-sync';
import { useSession } from '@/features/auth';
import { useFeatures } from '@/lib/use-features';
import { useDismissGuide, useMyProfile } from '../hooks/use-my-profile';

/** Remembers closed first-visit guides on the server for logged-in members. */
export function GuideSyncProvider({ children }: { children: ReactNode }) {
  const features = useFeatures();
  const enabled =
    (features.data?.modules.includes('auth') && features.data.modules.includes('users')) ?? false;
  const session = useSession({ enabled });
  const profile = useMyProfile({ enabled: enabled && session.user !== null });
  const dismissGuide = useDismissGuide();
  const { mutate } = dismissGuide;

  const value = useMemo<GuideSync | null>(() => {
    const dismiss = (moduleKey: string) => mutate(moduleKey);
    if (features.isPending) return { status: 'loading', dismissed: [], dismiss };
    if (!enabled) return null;
    if (session.isPending) return { status: 'loading', dismissed: [], dismiss };
    if (!session.user) return null;
    if (profile.isPending) return { status: 'loading', dismissed: [], dismiss };
    // If the server copy cannot be read, fall back to this device's memory.
    if (!profile.data) return null;
    return { status: 'ready', dismissed: profile.data.dismissedGuides, dismiss };
  }, [
    features.isPending,
    enabled,
    session.isPending,
    session.user,
    profile.isPending,
    profile.data,
    mutate,
  ]);

  return <GuideSyncContext value={value}>{children}</GuideSyncContext>;
}
