import type { Metadata } from 'next';
import { FirstVisitGuide } from '@/components/guide/FirstVisitGuide';
import { ItemForm, lostFoundHelp } from '@/features/lost-found';

export const metadata: Metadata = { title: lostFoundHelp.form.newTitle };

export default function NewLostFoundPage() {
  return (
    <>
      <ItemForm />
      <FirstVisitGuide moduleKey="lost-found" steps={lostFoundHelp.intro} />
    </>
  );
}
