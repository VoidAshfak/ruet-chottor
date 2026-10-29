'use client';

import { useSession } from '@/features/auth';
import { useMyProfile } from '../hooks/use-my-profile';
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
      <GuideReset />
    </div>
  );
}
