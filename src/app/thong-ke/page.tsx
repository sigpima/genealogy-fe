'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { StatsView } from '@/components/stats/StatsView';
import { canManage } from '@/lib/auth/session';

export default function StatsPage() {
  const router = useRouter();
  const session = useSession();
  const handleUnauthorized = useCallback(() => router.replace('/login'), [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  if (session.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-app">
        <div className="size-8 animate-spin rounded-full border-2 border-default border-t-transparent" />
      </div>
    );
  }
  return (
    <AppShell clanName="Thống kê" user={session.user} active="stats" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <StatsView isAdmin={canManage(session.user)} onUnauthorized={handleUnauthorized} />
      </div>
    </AppShell>
  );
}
