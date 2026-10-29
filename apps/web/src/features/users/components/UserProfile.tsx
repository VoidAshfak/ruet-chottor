'use client';

import { useSession } from '@/features/auth';
import { ApiError } from '@/lib/api-client';
import { help } from '../help';
import { useProfile } from '../hooks/use-profile';
import { LoadError } from './LoadError';
import { LoginNeeded } from './LoginNeeded';
import { ProfileDetails } from './ProfileDetails';
import { ProfileSkeleton } from './ProfileSkeleton';

/** Another member's profile, as the server allows us to see it. */
export function UserProfile({ userId }: { userId: string }) {
  const session = useSession();
  const profile = useProfile(userId, { enabled: session.user !== null });

  if (session.isPending) return <ProfileSkeleton />;
  if (!session.user) return <LoginNeeded />;
  if (profile.isPending) return <ProfileSkeleton />;
  if (profile.isError) {
    const missing = profile.error instanceof ApiError && [400, 404].includes(profile.error.status);
    if (missing) {
      return <p className="rounded-lg border p-6 text-muted-foreground">{help.profile.notFound}</p>;
    }
    return <LoadError message={profile.error.message} onRetry={() => void profile.refetch()} />;
  }

  return <ProfileDetails profile={profile.data} />;
}
