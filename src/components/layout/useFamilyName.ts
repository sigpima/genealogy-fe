'use client';

import { useEffect, useState } from 'react';
import { familyNameFor } from '@/lib/auth/familyName';
import type { CurrentUser } from '@/lib/auth/session';

/**
 * What the header knows about the family: its name (from the account, or for a superadmin / guest from the API) and, for a
 * guest only, its slug (the demo banner keys off it). Null until known.
 */
export function useFamilySite(user: CurrentUser | null): { familyName: string | null; treeSlug: string | null } {
  const [trees, setTrees] = useState<{ name: string; is_current: boolean }[] | null>(null);
  const [site, setSite] = useState<{ name: string | null; slug: string | null }>({ name: null, slug: null });
  const role = user?.role ?? null;
  const needsTrees = role === 'superadmin';
  const needsSite = user === null;

  useEffect(() => {
    if (!needsTrees) return;
    let cancelled = false;
    fetch('/api/trees', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => !cancelled && setTrees(rows))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needsTrees]);

  useEffect(() => {
    if (!needsSite) return;
    let cancelled = false;
    fetch('/api/site/info', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => !cancelled && setSite({ name: info?.tree_name ?? null, slug: info?.tree_slug ?? null }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needsSite]);

  return { familyName: familyNameFor(user, trees, site.name), treeSlug: needsSite ? site.slug : null };
}
