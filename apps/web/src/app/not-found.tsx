import Link from 'next/link';
import { PageHeader } from '@/components/guide/PageHeader';

export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="This page does not exist, or the section is not available yet."
      />
      <Link href="/" className="text-sm underline underline-offset-4">
        Go to the home page
      </Link>
    </>
  );
}
