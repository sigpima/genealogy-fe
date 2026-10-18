'use client';

import { useEffect, useState } from 'react';
import { clampDepth } from '@/lib/tree/generationStepper';

export type GenerationFilterBarProps = {
  /** First generation of what is shown: 1 for the whole tree, the branch root's generation in a branch view. */
  min: number;
  /** The youngest generation present. */
  max: number;
  /** The deepest generation shown now. */
  value: number;
  onChange: (depth: number) => void;
  /** The tree is big, so it opened on a few generations only. */
  capped?: boolean;
};

const BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-lg font-semibold text-default hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40';

export function GenerationFilterBar({ min, max, value, onChange, capped }: GenerationFilterBarProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  function commit(raw: string | number) {
    const next = clampDepth(raw, min, max);
    setDraft(String(next));
    if (next !== value) onChange(next);
  }

  return (
    <div
      role="group"
      aria-label="Số đời hiển thị"
      className="shadow-float absolute left-4 right-4 top-4 z-20 flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border-default border bg-glass px-3 py-2 backdrop-blur-md sm:right-auto"
    >
      <label htmlFor="generation-depth" className="shrink-0 text-sm font-medium text-default">
        Hiển thị đến đời
      </label>
      <button type="button" aria-label="Bớt một đời" disabled={value <= min} onClick={() => commit(value - 1)} className={BUTTON}>
        −
      </button>
      <input
        id="generation-depth"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(draft);
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            commit(clampDepth(draft, min, max) + 1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            commit(clampDepth(draft, min, max) - 1);
          }
        }}
        className="h-11 w-16 rounded-lg border-default border bg-app text-center text-base text-default [appearance:textfield] focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" aria-label="Thêm một đời" disabled={value >= max} onClick={() => commit(value + 1)} className={BUTTON}>
        +
      </button>
      <span className="text-sm text-muted">
        trên tổng {max} đời{min > 1 ? ` · từ đời ${min}` : ''}
        {capped ? ' · hiển thị bớt cho nhanh' : ''}
      </span>
    </div>
  );
}
