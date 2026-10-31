'use client';

import { useMyProfile } from '@/features/users';
import { useFeatures } from '@/lib/use-features';

/**
 * The class the viewer is a verified CR of ("CSE 2021 · Section A"), or null. Class events need
 * the users and admin modules (CR verification and reviews).
 */
export function useMyClass(): string | null {
  const modules = useFeatures().data?.modules ?? [];
  const on = modules.includes('users') && modules.includes('admin');
  const profile = useMyProfile({ enabled: on }).data;
  if (!on || !profile?.classRep || !profile.department || profile.series === null) return null;
  const section = profile.classRep.section;
  return `${profile.department.short} ${profile.series}${section ? ` · Section ${section}` : ''}`;
}
