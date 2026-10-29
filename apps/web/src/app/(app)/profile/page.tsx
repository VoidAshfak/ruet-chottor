import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { MyProfile, usersHelp } from '@/features/users';

export const metadata: Metadata = { title: usersHelp.myProfile.title };

export default function MyProfilePage() {
  return (
    <>
      <PageHeader title={usersHelp.myProfile.title} description={usersHelp.myProfile.description} />
      <MyProfile />
      <FirstVisitGuide moduleKey="users" steps={usersHelp.intro} />
    </>
  );
}
