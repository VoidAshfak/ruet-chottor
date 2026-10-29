import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/guide/PageHeader';
import { authHelp, LoginForm } from '@/features/auth';

export const metadata: Metadata = { title: authHelp.login.title };

export default function LoginPage() {
  return (
    <>
      <PageHeader title={authHelp.login.title} description={authHelp.login.description} />
      {/* LoginForm reads ?created= from the URL, so it renders in the browser only. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
