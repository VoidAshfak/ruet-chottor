import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { PageHeader } from '@/components/guide/PageHeader';
import { authHelp, SignupForm } from '@/features/auth';

export const metadata: Metadata = { title: authHelp.signup.title };

export default function SignupPage() {
  return (
    <>
      <PageHeader title={authHelp.signup.title} description={authHelp.signup.description} />
      <SignupForm />
      <FirstVisitGuide moduleKey="auth" steps={authHelp.intro} />
    </>
  );
}
