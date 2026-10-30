'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';

/**
 * The header's link style: muted text, tinted background when it is the current section, and an
 * orange bar that grows in under it on hover and stays under the current one.
 */
export const NAV_LINK_CLASS =
  'relative rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-brand-orange after:transition-transform hover:after:scale-x-100 aria-[current=page]:after:scale-x-100 motion-reduce:after:transition-none';

type NavLinkProps = {
  href: string;
  className: string;
  /** e.g. close the mobile menu after choosing a section. */
  onClick?: () => void;
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

function PlainNavLink({
  href,
  className,
  children,
  active,
  onClick,
}: NavLinkProps & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
