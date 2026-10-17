'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSession } from '@/components/auth/useSession';
import { AppShell } from '@/components/layout/AppShell';
import { SearchView } from '@/components/search/SearchView';

export default function SearchPage() {
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
    <AppShell clanName="Tìm kiếm" user={session.user} active="search" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <SearchView onUnauthorized={handleUnauthorized} />
      </div>
    </AppShell>
  );
}
