'use client';

import { useState } from 'react';
import { usePersonSearch } from '@/components/common/usePersonSearch';

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
  const options = usePersonSearch(query, { excludeIds });

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
