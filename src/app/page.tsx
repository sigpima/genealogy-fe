'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/components/auth/useSession';
import { usePersonSearch } from '@/components/common/usePersonSearch';
import { AppShell } from '@/components/layout/AppShell';
import GenealogyTree, { type FocusRequest } from '@/components/tree/GenealogyTree';
import { landingPath } from '@/lib/auth/landing';
import { canEdit, type CurrentUser } from '@/lib/auth/session';
import { shouldFocusMe } from '@/lib/invites/invites';
import type { Branch } from '@/lib/branches/branches';
import { parseFocusParam } from '@/lib/search/search';
import { clanName } from '@/lib/tree/generations';
import { generateSyntheticTree } from '@/lib/tree/synthetic';
import { findAncestorChainById, findMembersByName } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

/** A fresh install's superadmin has no family to show: the platform console is where to start. Null = stay here. */
async function emptyInstallTarget(): Promise<string | null> {
  try {
    const me = await fetch('/api/auth/me', { credentials: 'include' });
    if (!me.ok) return null;
    const trees = await fetch('/api/trees', { credentials: 'include' });
    if (!trees.ok) return null;
    const path = landingPath((await me.json()) as CurrentUser, ((await trees.json()) as unknown[]).length);
    return path === '/' ? null : path;
  } catch {
    return null;
  }
}

export default function Home() {
  const router = useRouter();
  const session = useSession();
  const userCanEdit = canEdit(session.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [familyTree, setFamilyTree] = useState<FamilyMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isSynthetic, setIsSynthetic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(
    async (options?: { silent?: boolean }) => {
      // Dev-only load test: /?synthetic=2000 swaps the API for a generated tree.
      // Add &details=1 to keep per-member detail fetching on (to load-test it against a mocked API).
      const devParams = process.env.NODE_ENV !== 'production' ? new URLSearchParams(window.location.search) : null;
      const syntheticCount = Number(devParams?.get('synthetic') ?? 0);
      if (syntheticCount > 0) {
        setFamilyTree(generateSyntheticTree(syntheticCount));
        setIsSynthetic(devParams?.get('details') !== '1');
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
          const target = response.status === 404 ? await emptyInstallTarget() : null;
          if (target) {
            router.replace(target);
            return;
          }
          setError('Không thể tải dữ liệu gia phả. Vui lòng thử lại.');
          return;
        }
        const data = (await response.json()) as FamilyMember | null;
        setFamilyTree(data);
        // Branch colours are a nicety: a failure here must never break the tree.
        fetch('/api/branches', { credentials: 'include' })
          .then((r) => (r.ok ? (r.json() as Promise<Branch[]>) : []))
          .then(setBranches)
          .catch(() => undefined);
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

  // /?focus=<id> (a search result, a branch link) opens the tree on that person, once.
  useEffect(() => {
    if (!familyTree) return;
    const id = parseFocusParam(window.location.search);
    if (id === null) {
      // a linked person lands on themself, once per browser session
      const mine = session.user?.member;
      let storage: Storage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }
      if (mine && shouldFocusMe(storage, mine.id)) {
        const chain = findAncestorChainById(familyTree, mine.id);
        if (chain) setFocusRequest({ id: mine.id, name: chain[chain.length - 1].name, token: Date.now() });
      }
      return;
    }
    window.history.replaceState(null, '', window.location.pathname);
    const chain = findAncestorChainById(familyTree, id);
    if (chain) setFocusRequest({ id, name: chain[chain.length - 1].name, token: Date.now() });
    // the parameter is consumed once (then removed); the person focus is guarded by sessionStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyTree === null, session.user?.member?.id]);

  // the same ranked search as every other person box (the dev-only synthetic tree has no API behind it: it keeps the in-page search)
  const found = usePersonSearch(searchQuery, { enabled: !isSynthetic });
  const syntheticMatches = isSynthetic && familyTree ? findMembersByName(familyTree, searchQuery) : [];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  }

  // An account that was disabled (or never approved) while its cookie was still around: drop the cookie.
  useEffect(() => {
    if (session.isBlocked) void handleLogout();
    // handleLogout only uses router, which is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isBlocked]);

  return (
    <AppShell
      clanName={clanName(familyTree?.name ?? '')}
      user={session.user}
      active="tree"
      onLogout={handleLogout}
      search={{
        query: searchQuery,
        onQueryChange: setSearchQuery,
        results: isSynthetic
          ? syntheticMatches.map((match) => ({
              key: match.path.join(' > '),
              label: match.member.name,
              hint: `đời ${match.path.length}`,
              onSelect: () => {
                setFocusRequest({ id: match.member.id ?? -1, name: match.member.name, token: Date.now() });
                setSearchQuery('');
              },
            }))
          : found.map((person) => ({
              key: String(person.id),
              label: person.name,
              hint: person.hint,
              onSelect: () => {
                setFocusRequest({ id: person.id, name: person.name, token: Date.now() });
                setSearchQuery('');
              },
            })),
      }}
    >
      <div className="h-full overflow-hidden">
          {(isLoading || session.isLoading) && (
            <div className="flex h-full items-center justify-center bg-app">
              <div className="size-8 animate-spin rounded-full border-2 border-default border-t-transparent" />
            </div>
          )}
          {!isLoading && !session.isLoading && error && (
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
          {!isLoading && !session.isLoading && !error && !familyTree && (
            <div className="flex h-full items-center justify-center bg-app">
              {userCanEdit ? (
                <EmptyTreeState onCreated={() => loadTree({ silent: true })} />
              ) : (
                <p className="text-sm text-muted">Chưa có dữ liệu gia phả.</p>
              )}
            </div>
          )}
          {!isLoading && !session.isLoading && !error && familyTree && (
            <GenealogyTree
              familyTree={familyTree}
              focusRequest={focusRequest}
              branches={branches}
              onDataChanged={() => loadTree({ silent: true })}
              synthetic={isSynthetic}
              canEdit={userCanEdit}
              canPropose={session.user !== null && !userCanEdit}
              signedIn={session.user !== null}
              me={session.user ? { userId: session.user.id, role: session.user.role, member: session.user.member ?? null } : null}
              onMeChanged={() => void session.refresh()}
            />
          )}
      </div>
    </AppShell>
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
