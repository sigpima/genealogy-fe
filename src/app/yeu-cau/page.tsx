'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { RequestsView } from '@/components/requests/RequestsView';
import { canManage } from '@/lib/auth/session';

export default function RequestsPage() {
  const router = useRouter();
  const session = useSession();
  const handleUnauthorized = useCallback(() => router.replace('/login'), [router]);

  useEffect(() => {
    if (!session.isLoading && !session.user) router.replace('/login');
  }, [session.isLoading, session.user, router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  if (session.isLoading || !session.user) {
    return (
      <div className="flex h-screen items-center justify-center bg-app">
        <div className="size-8 animate-spin rounded-full border-2 border-default border-t-transparent" />
      </div>
    );
  }

  return (
    <AppShell user={session.user} active="requests" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <RequestsView isAdmin={canManage(session.user)} onUnauthorized={handleUnauthorized} />
      </div>
    </AppShell>
  );
}
