'use client';

import type { Branch } from '@/lib/branches/branches';
import { sortBranches } from '@/lib/branches/branches';

export type BranchChipsProps = {
  branches: Branch[];
  /** Fly to the branch's head. */
  onSelect: (branch: Branch) => void;
};

/** One chip per branch (chi/phái) under the generation bar; the dot is the colour used on its cards. */
export function BranchChips({ branches, onSelect }: BranchChipsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Đến chi phái"
      className="shadow-float absolute left-4 right-4 top-[4.5rem] z-20 flex max-w-full items-center gap-x-1.5 overflow-x-auto rounded-xl border-default border bg-glass px-3 py-1.5 backdrop-blur-md sm:right-auto sm:max-w-[min(48rem,calc(100%-2rem))]"
    >
      <span className="me-1 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">Chi:</span>
      {sortBranches(branches).map((branch) => (
        <button
          key={branch.id}
          type="button"
          onClick={() => onSelect(branch)}
          title={`Đến ${branch.root_name} · ${branch.member_count} người`}
          className="flex min-h-9 shrink-0 items-center gap-x-1.5 whitespace-nowrap rounded-lg bg-surface-muted px-2.5 text-xs font-medium text-default hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        >
          <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ backgroundColor: branch.color }} />
          {branch.name}
        </button>
      ))}
    </div>
  );
}
