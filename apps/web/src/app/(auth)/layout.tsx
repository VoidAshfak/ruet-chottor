import { RuetGate } from '@/components/art/RuetGate';

/** Narrow, centred column for the sign-up and login forms, entered through the RUET gate. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="mx-auto grid w-full max-w-lg gap-6">
      <RuetGate className="h-auto w-full" />
      <div>{children}</div>
    </div>
  );
}
