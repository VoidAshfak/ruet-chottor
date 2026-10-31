import { RuetEntrance } from '@/components/art/RuetEntrance';

/** Narrow, centred column for the sign-up and login forms, under the RUET entrance gate. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="mx-auto grid w-full max-w-lg gap-6">
      <div className="rounded-2xl bg-accent px-3 pt-5">
        <RuetEntrance className="h-auto w-full" />
      </div>
      <div>{children}</div>
    </div>
  );
}
