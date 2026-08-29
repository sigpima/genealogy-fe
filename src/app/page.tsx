'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import GenealogyTree, { type FocusRequest } from './genealogy-tree/page';
import Sidebar from './sidebar';
import { findMembersByName } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [familyTree, setFamilyTree] = useState<FamilyMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/members/tree', { credentials: 'include' });
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setError('Không thể tải dữ liệu gia phả. Vui lòng thử lại.');
        return;
      }
      const data = (await response.json()) as FamilyMember | null;
      setFamilyTree(data);
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const matches = familyTree ? findMembersByName(familyTree, searchQuery) : [];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={matches.map((match) => ({
            key: match.path.join(' > '),
            label: match.path.join(' → '),
            onSelect: () => setFocusRequest({ path: match.path, token: Date.now() }),
          }))}
          onLogout={handleLogout}
        />
        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="flex h-full items-center justify-center bg-app">
              <div className="size-8 animate-spin rounded-full border-2 border-default border-t-transparent" />
            </div>
          )}
          {!isLoading && error && (
            <div className="flex h-full flex-col items-center justify-center gap-y-4 bg-app text-center">
              <p className="text-sm text-danger">{error}</p>
              <button
                type="button"
                onClick={loadTree}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90"
              >
                Thử lại
              </button>
            </div>
          )}
          {!isLoading && !error && !familyTree && (
            <div className="flex h-full items-center justify-center bg-app">
              <p className="text-sm text-muted">Chưa có dữ liệu gia phả.</p>
            </div>
          )}
          {!isLoading && !error && familyTree && (
            <GenealogyTree familyTree={familyTree} focusRequest={focusRequest} />
          )}
        </div>
      </div>
    </div>
  );
}
