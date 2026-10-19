'use client';

import { useEffect, useState } from 'react';
import { personOptions, type PersonOption, type SearchPage } from '@/lib/search/search';

/**
 * Search-as-you-type over the family (the API's ranked search: exact name, then prefix, then word prefix, then contains; accents ignored).
 * Used by every person search box so they all find people the same way. Returns nothing while the box is empty or `enabled` is false.
 */
export function usePersonSearch(query: string, { limit = 8, excludeIds = [], enabled = true }: { limit?: number; excludeIds?: number[]; enabled?: boolean } = {}): PersonOption[] {
  const [options, setOptions] = useState<PersonOption[]>([]);

  useEffect(() => {
    const text = query.trim();
    if (!enabled || !text) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch(`/api/members/search?${new URLSearchParams({ q: text, limit: String(limit) })}`, { credentials: 'include' })
        .then((r) => (r.ok ? (r.json() as Promise<SearchPage>) : null))
        .then((page) => !cancelled && setOptions(personOptions(page?.items ?? [], excludeIds)))
        .catch(() => !cancelled && setOptions([]));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // excludeIds is a fresh array every render; the query is what should trigger a search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, enabled, limit]);

  return options;
}
