'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { TreesPanel } from '@/components/platform/TreesPanel';

export default function PlatformPage() {
  const router = useRouter();
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

  return (
    <AppShell clanName="Các họ" user={session.user} active="platform" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 sm:px-6">
          <h1 className="font-display text-2xl font-bold text-default">Quản lý các họ</h1>
          <p className="pb-4 text-sm text-muted">
            Mỗi họ có cây, admin và cài đặt riêng. Tạo họ mới kèm admin ở đây; duyệt người dùng và đổi cài đặt của một họ thì
            bấm “Quản trị” ở họ đó.
          </p>
          <TreesPanel />
        </div>
      </div>
    </AppShell>
  );
}
