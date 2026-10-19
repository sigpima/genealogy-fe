'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { canManage, type CurrentUser } from '@/lib/auth/session';
import { visibleSections } from '@/lib/admin/sections';

/**
 * Every admin page: the app chrome, the sign-in/admin guard, a "← Quản trị" link and (on wide screens) a slim list of
 * the other areas. `title` is the page's h1; the home passes none and renders its own.
 */
export function AdminFrame({
  title,
  children,
}: {
  title?: string;
  children: (user: CurrentUser) => React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const isAdmin = canManage(session.user);

  useEffect(() => {
    if (session.isLoading) return;
    if (!session.user) router.replace('/login');
    else if (!isAdmin) router.replace('/');
  }, [session.isLoading, session.user, isAdmin, router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  if (session.isLoading || !isAdmin || !session.user) {
    return (
      <div className="flex h-screen items-center justify-center bg-app">
        <div className="size-8 animate-spin rounded-full border-2 border-default border-t-transparent" />
      </div>
    );
  }

  const user = session.user;
  return (
    <AppShell
      user={user}
      active="admin"
      onLogout={handleLogout}
    >
      <div className="h-full overflow-y-auto bg-app">
        <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 sm:px-6">
          <nav aria-label="Các mục quản trị" className="hidden w-48 shrink-0 lg:block">
            <ul className="sticky top-6 space-y-1">
              <li>
                <Link
                  href="/admin"
                  aria-current={pathname === '/admin' ? 'page' : undefined}
                  className={navLink(pathname === '/admin')}
                >
                  Cần làm
                </Link>
              </li>
              {visibleSections().map((s) => (
                <li key={s.id}>
                  <Link href={s.href} aria-current={pathname === s.href ? 'page' : undefined} className={navLink(pathname === s.href)}>
                    <AdminIcon icon={s.icon} size={18} />
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <main className="min-w-0 flex-1">
            {title && (
              <>
                <Link
                  href="/admin"
                  className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-base text-default underline hover:no-underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  ← Quản trị
                </Link>
                <h1 className="font-display mb-6 text-2xl font-bold text-default">{title}</h1>
              </>
            )}
            {children(user)}
          </main>
        </div>
      </div>
    </AppShell>
  );
}

function navLink(current: boolean): string {
  return `flex min-h-11 items-center gap-2 rounded-lg px-3 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
    current ? 'bg-highlight bar-gold font-semibold text-default' : 'text-default hover:bg-surface-muted'
  }`;
}
