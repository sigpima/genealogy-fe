'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { PlacesView } from '@/components/places/PlacesView';
import { canManage } from '@/lib/auth/session';

export default function PlacesPage() {
  const router = useRouter();
  const session = useSession();
  const handleUnauthorized = useCallback(() => router.replace('/login'), [router]);

  // Places are burial information: signed-in users only.
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
    <AppShell user={session.user} active="places" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <PlacesView isAdmin={canManage(session.user)} onUnauthorized={handleUnauthorized} />
      </div>
    </AppShell>
  );
}
