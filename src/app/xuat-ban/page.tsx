'use client';

import { useRouter } from 'next/navigation';
import { BookView } from '@/components/export/BookView';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { canManage } from '@/lib/auth/session';

export default function BookPage() {
  const router = useRouter();
  const session = useSession();

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
    <AppShell clanName="Xuất bản" user={session.user} active="export" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <BookView canManage={canManage(session.user)} />
      </div>
    </AppShell>
  );
}
