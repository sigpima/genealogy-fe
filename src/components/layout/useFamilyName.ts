'use client';

import { useEffect, useState } from 'react';
import { familyNameFor } from '@/lib/auth/familyName';
import type { CurrentUser } from '@/lib/auth/session';

/** The family's name for the header: from the account, or (superadmin / guest) from the API. Null until known. */
export function useFamilyName(user: CurrentUser | null): string | null {
  const [trees, setTrees] = useState<{ name: string; is_current: boolean }[] | null>(null);
  const [siteName, setSiteName] = useState<string | null>(null);
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
      .then((info) => !cancelled && setSiteName(info?.tree_name ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [needsSite]);

  return familyNameFor(user, trees, siteName);
}
