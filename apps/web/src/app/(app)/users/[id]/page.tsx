import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/guide/PageHeader';
import { ProfileSkeleton, UserProfile, usersHelp } from '@/features/users';

export const metadata: Metadata = { title: usersHelp.profile.title };

export default function UserProfilePage({ params }: PageProps<'/users/[id]'>) {
  return (
    <>
      <PageHeader title={usersHelp.profile.title} description={usersHelp.profile.description} />
      {/* The id is only known at request time (Cache Components), so it is read inside Suspense. */}
      <Suspense fallback={<ProfileSkeleton />}>
        {params.then(({ id }) => (
          <UserProfile userId={id} />
        ))}
      </Suspense>
    </>
  );
}
