'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SettingsPanel } from '@/components/admin/SettingsPanel';
import { UsersPanel } from '@/components/admin/UsersPanel';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';

type Tab = 'users' | 'settings';

export default function AdminPage() {
  const router = useRouter();
  const session = useSession();
  const [tab, setTab] = useState<Tab>('users');
  const [pending, setPending] = useState(0);

  const isAdmin = session.user?.role === 'admin';

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

  const tabs: { id: Tab; label: string }[] = [
    {
      id: 'users',
      label: pending > 0 ? `Người dùng (${pending} chờ duyệt)` : 'Người dùng',
    },
    { id: 'settings', label: 'Cài đặt' },
  ];

  return (
    <AppShell
      clanName="Quản trị"
      user={session.user}
      active="admin"
      onLogout={handleLogout}
    >
      <div className="h-full overflow-y-auto bg-app">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div
            role="tablist"
            aria-label="Quản trị"
            className="mb-6 flex border-default border-b"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-11 border-b-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                  tab === t.id
                    ? 'border-[var(--color-primary)] text-primary'
                    : 'border-transparent text-muted hover:text-default'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'users' ? (
              <UsersPanel
                currentUserId={session.user.id}
                onPendingCount={setPending}
              />
            ) : (
              <SettingsPanel />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
