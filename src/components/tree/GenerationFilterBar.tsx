'use client';

import { useState } from 'react';
import { toRoman } from '@/lib/tree/generations';

export type GenerationFilterBarProps = {
  counts: number[];
  activeDepth: number | null;
  onSelectDepth: (depth: number) => void;
};

const VISIBLE_CHIPS = 6;

export function GenerationFilterBar({ counts, activeDepth, onSelectDepth }: GenerationFilterBarProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? counts : counts.slice(0, VISIBLE_CHIPS);
  const hidden = counts.length - shown.length;

  return (
    <div
      role="toolbar"
      aria-label="Chọn số đời hiển thị"
      className="shadow-float absolute left-4 right-4 top-4 z-20 flex max-w-full items-center gap-x-1.5 overflow-x-auto rounded-xl border-default border bg-surface/90 px-3 py-2 backdrop-blur-md sm:right-auto"
    >
      <span className="me-1 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">Đời:</span>
      {shown.map((count, index) => {
        const depth = index + 1;
        const active = activeDepth === depth;
        return (
          <button
            key={depth}
            type="button"
            aria-pressed={active}
            onClick={() => onSelectDepth(depth)}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
              active ? 'bg-primary text-on-primary' : 'bg-surface-muted text-default hover:opacity-80'
            }`}
          >
            {depth === 1 ? 'Đời I (Khởi Tổ)' : `Đời ${toRoman(depth)} (${count})`}
          </button>
        );
      })}
      {(hidden > 0 || showAll) && counts.length > VISIBLE_CHIPS && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="min-h-9 shrink-0 rounded-lg bg-surface-muted px-2.5 text-xs text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        >
          {showAll ? 'Thu gọn' : `+${hidden} đời`}
        </button>
      )}
    </div>
  );
}
