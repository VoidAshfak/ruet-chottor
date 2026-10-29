/** Narrow, centred column for the sign-up and login forms. */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return <div className="mx-auto w-full max-w-lg">{children}</div>;
}
