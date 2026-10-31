'use client';

import { CLASS_REP_ELIGIBLE_ROLES } from '@ruet-chottor/shared';
import { useSession } from '@/features/auth';
import { useFeatures } from '@/lib/use-features';
import { useMyProfile } from '../hooks/use-my-profile';
import { ClassRepCard } from './ClassRepCard';
import { GuideReset } from './GuideReset';
import { LoadError } from './LoadError';
import { LoginNeeded } from './LoginNeeded';
import { PrivacySettings } from './PrivacySettings';
import { ProfileDetails } from './ProfileDetails';
import { ProfileSkeleton } from './ProfileSkeleton';

/** The logged-in member's own profile and settings. */
export function MyProfile() {
  const session = useSession();
  const profile = useMyProfile({ enabled: session.user !== null });
  // Class rep reviews live in the admin panel, so the card needs that module on.
  const classReps = useFeatures().data?.modules.includes('admin') ?? false;

  if (session.isPending) return <ProfileSkeleton />;
  if (!session.user) return <LoginNeeded />;
  if (profile.isPending) return <ProfileSkeleton />;
  if (profile.isError) {
    return <LoadError message={profile.error.message} onRetry={() => void profile.refetch()} />;
  }

  return (
    <div className="grid gap-6">
      <ProfileDetails profile={profile.data} showTips />
      <PrivacySettings profile={profile.data} />
      {classReps && (CLASS_REP_ELIGIBLE_ROLES as readonly string[]).includes(profile.data.role) ? (
        <ClassRepCard profile={profile.data} />
      ) : null}
      <GuideReset />
    </div>
  );
}
