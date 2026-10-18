'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import type { CurrentUser } from '@/lib/auth/session';
import { visiblePlatformSections } from '@/lib/platform/sections';

/** Every superadmin page: app chrome, the superadmin guard, a "← Nền tảng" link, a slim section list on wide screens. `title` is the page's h1 (the home passes none). */
export function PlatformFrame({ title, children }: { title?: string; children: (user: CurrentUser) => React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const isSuperadmin = session.user?.role === 'superadmin';

  useEffect(() => {
    if (session.isLoading) return;
    if (!session.user) router.replace('/login');
    else if (!isSuperadmin) router.replace('/');
  }, [session.isLoading, session.user, isSuperadmin, router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  if (session.isLoading || !isSuperadmin || !session.user) {
    return (
      <div className="flex h-screen items-center justify-center bg-app">
        <div className="size-8 animate-spin rounded-full border-2 border-default border-t-transparent" />
      </div>
    );
  }

  const link = (current: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-lg px-3 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
      current ? 'bg-surface-muted font-semibold text-primary' : 'text-default hover:bg-surface-muted'
    }`;

  return (
    <AppShell clanName="Quản trị nền tảng" user={session.user} active="platform" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 sm:px-6">
          <nav aria-label="Các mục nền tảng" className="hidden w-48 shrink-0 lg:block">
            <ul className="sticky top-6 space-y-1">
              <li>
                <Link href="/he-thong" aria-current={pathname === '/he-thong' ? 'page' : undefined} className={link(pathname === '/he-thong')}>
                  Cần làm
                </Link>
              </li>
              {visiblePlatformSections().map((s) => (
                <li key={s.id}>
                  <Link href={s.href} aria-current={pathname === s.href ? 'page' : undefined} className={link(pathname === s.href)}>
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
                  href="/he-thong"
                  className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-base text-default underline hover:no-underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  ← Nền tảng
                </Link>
                <h1 className="font-display mb-6 text-2xl font-bold text-default">{title}</h1>
              </>
            )}
            {children(session.user)}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
