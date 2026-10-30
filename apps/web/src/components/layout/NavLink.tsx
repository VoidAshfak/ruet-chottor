'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

type NavLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
  /** Defaults to "the path starts with href". */
  isActive?: (pathname: string) => boolean;
};

/**
 * A link marked `aria-current="page"` while its section is open.
 * With Cache Components, `usePathname()` suspends on routes with request-time params
 * (e.g. `/users/[id]`), so the link prerenders without the active state and gains it on the client.
 */
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<PlainNavLink {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink(props: NavLinkProps) {
  const pathname = usePathname();
  const active = props.isActive ? props.isActive(pathname) : pathname.startsWith(props.href);
  return <PlainNavLink {...props} active={active} />;
}

function PlainNavLink({ href, className, children, active }: NavLinkProps & { active: boolean }) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} className={className}>
      {children}
    </Link>
  );
}
