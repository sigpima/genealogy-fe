'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { AuditView } from '@/components/audit/AuditView';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { canManage } from '@/lib/auth/session';

export default function AuditPage() {
  const router = useRouter();
  const session = useSession();
  const isAdmin = canManage(session.user);

  useEffect(() => {
    if (session.isLoading) return;
    if (!session.user) router.replace('/login');
    else if (!isAdmin) router.replace('/');
  }, [session.isLoading, session.user, isAdmin, router]);

  const handleUnauthorized = useCallback(() => router.replace('/'), [router]);

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

  return (
    <AppShell user={session.user} active="audit" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <AuditView onUnauthorized={handleUnauthorized} />
      </div>
    </AppShell>
  );
}
