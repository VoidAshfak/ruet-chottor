import Link from 'next/link';
import { LostArt } from '@/components/art/LostArt';
import { PageHeader } from '@/components/guide/PageHeader';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md justify-items-center text-center">
      <LostArt className="mb-4 h-auto w-56" />
      <PageHeader
        title="Page not found"
        description="This page does not exist, or the section is not available yet."
        centered
      />
      <Button asChild>
        <Link href="/">Go to the home page</Link>
      </Button>
    </div>
  );
}
