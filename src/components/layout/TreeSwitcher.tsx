'use client';

import { useEffect, useState } from 'react';
import type { CurrentUser } from '@/lib/auth/session';
import { enterFamily, type PlatformTree } from '@/lib/platform/trees';

/** Picks the family the superadmin acts on (the API reads the `acting_tree` cookie). Only shown when there are
 * at least two families; a reload follows, so every view starts again from the chosen family. */
export function TreeSwitcher({ user }: { user: CurrentUser | null }) {
  const [trees, setTrees] = useState<PlatformTree[]>([]);
  const isSuperadmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!isSuperadmin) return;
    let cancelled = false;
    fetch('/api/trees', { credentials: 'include' })
      .then((response) => (response.ok ? (response.json() as Promise<PlatformTree[]>) : []))
      .then((rows) => {
        if (!cancelled) setTrees(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin]);

  if (!isSuperadmin || trees.length < 2) return null;
  const current = trees.find((t) => t.is_current) ?? trees[0];

  return (
    <label className="flex items-center gap-x-2 text-xs text-muted">
      <span className="hidden sm:inline">Họ đang xem</span>
      <select
        aria-label="Chọn họ để xem và quản lý"
        value={current.id}
        onChange={async (e) => {
          // the entry is logged on the platform first; if that fails we stay where we are
          if (await enterFamily(Number(e.target.value))) window.location.assign(window.location.pathname);
        }}
        className="h-10 max-w-44 rounded-lg border-default border bg-app px-2 text-sm text-default focus:border-[var(--color-primary)] focus:outline-none"
      >
        {trees.map((tree) => (
          <option key={tree.id} value={tree.id}>
            {tree.name}
          </option>
        ))}
      </select>
    </label>
  );
}
