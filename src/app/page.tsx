'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import GenealogyTree, { type FocusRequest } from './genealogy-tree/page';
import Sidebar from './sidebar';
import { clanName } from '@/lib/tree/generations';
import { generateSyntheticTree } from '@/lib/tree/synthetic';
import { findMembersByName } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [familyTree, setFamilyTree] = useState<FamilyMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynthetic, setIsSynthetic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(
    async (options?: { silent?: boolean }) => {
      // Dev-only load test: /?synthetic=2000 swaps the API for a generated tree.
      const syntheticCount =
        process.env.NODE_ENV !== 'production'
          ? Number(new URLSearchParams(window.location.search).get('synthetic'))
          : 0;
      if (syntheticCount > 0) {
        setFamilyTree(generateSyntheticTree(syntheticCount));
        setIsSynthetic(true);
        setIsLoading(false);
        return;
      }
      if (!options?.silent) setIsLoading(true);
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
        if (!options?.silent) setIsLoading(false);
      }
    },
    [router],
  );

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
          clanName={clanName(familyTree?.name ?? '')}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={matches.map((match) => ({
            key: match.path.join(' > '),
            label: match.path.join(' → '),
            onSelect: () => {
              setFocusRequest({ id: match.member.id ?? -1, name: match.member.name, token: Date.now() });
              setSearchQuery('');
            },
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
                onClick={() => loadTree()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90"
              >
                Thử lại
              </button>
            </div>
          )}
          {!isLoading && !error && !familyTree && (
            <div className="flex h-full items-center justify-center bg-app">
              <EmptyTreeState onCreated={() => loadTree({ silent: true })} />
            </div>
          )}
          {!isLoading && !error && familyTree && (
            <GenealogyTree
              familyTree={familyTree}
              focusRequest={focusRequest}
              onDataChanged={() => loadTree({ silent: true })}
              synthetic={isSynthetic}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyTreeState({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), parent_id: null }),
      });
      if (!response.ok) {
        setError('Không thể thêm. Vui lòng thử lại.');
        return;
      }
      onCreated();
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-y-4">
      <p className="text-sm text-muted">Chưa có dữ liệu gia phả. Thêm người đầu tiên:</p>
      <div className="flex items-center gap-x-2">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Họ và tên"
          className="rounded-lg border-default border bg-surface px-3 py-2 text-sm text-default placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={isSubmitting || !fullName.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 disabled:opacity-50"
        >
          Thêm
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
