'use client';

import { useEffect, useState } from 'react';
import type { SearchPage } from '@/lib/search/search';

export type PickedPerson = { id: number; name: string };

/** Search-as-you-type for a person of the tree (accents ignored); calls `onPick` with the chosen one. */
export function PersonPicker({
  onPick,
  label = 'Tìm người',
  placeholder = 'Gõ tên để tìm...',
  excludeIds = [],
}: {
  onPick: (person: PickedPerson) => void;
  label?: string;
  placeholder?: string;
  excludeIds?: number[];
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ id: number; name: string; hint: string }[]>([]);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/members/search?${new URLSearchParams({ q: text, limit: '8' })}`, { credentials: 'include' })
        .then((r) => (r.ok ? (r.json() as Promise<SearchPage>) : null))
        .then((page) =>
          setOptions(
            (page?.items ?? [])
              .filter((i) => !i.is_spouse && !excludeIds.includes(i.id))
              .map((i) => ({ id: i.id, name: i.full_name, hint: `đời ${i.generation}${i.parent_name ? ` · con ${i.parent_name}` : ''}` })),
          ),
        )
        .catch(() => setOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
    // excludeIds is a fresh array every render; the query is what should trigger a search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className="mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none"
      />
      {options.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border-default border bg-surface">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: o.id, name: o.name });
                  setQuery('');
                  setOptions([]);
                }}
                className="block min-h-11 w-full px-3 py-2 text-left text-sm text-default hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                {o.name} <span className="text-xs text-muted">· {o.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
