'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSession } from '@/components/auth/useSession';
import { ArticleReader } from '@/components/chronicles/ArticleReader';
import { AppShell } from '@/components/layout/AppShell';
import { canManage } from '@/lib/auth/session';

export default function ArticlePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
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
    <AppShell user={session.user} active="chronicles" onLogout={handleLogout}>
      <div className="h-full overflow-y-auto bg-app">
        <ArticleReader slug={params.slug} isAdmin={canManage(session.user)} signedIn={session.user !== null} onUnauthorized={handleUnauthorized} />
      </div>
    </AppShell>
  );
}
