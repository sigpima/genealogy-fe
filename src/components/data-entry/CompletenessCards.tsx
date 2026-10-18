import type { ReactNode } from 'react';
import { completenessCards } from '@/lib/data-entry/completenessCards';
import type { Completeness, MissingField } from '@/lib/data-entry/types';

const ICONS: Record<MissingField, ReactNode> = {
  gender: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  birth_year: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  hometown: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  death_year: (
    <>
      <path d="M12 3v18M7 8h10" />
    </>
  ),
  avatar: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
};

type Props = {
  completeness: Completeness;
  /** The "missing" filters switched on. */
  active: MissingField[];
  onToggle: (field: MissingField) => void;
};

/** Five fixed progress cards (3 + 2); pressing one switches its "missing …" filter on or off. */
export function CompletenessCards({ completeness, active, onToggle }: Props) {
  return (
    <section aria-label="Mức độ đầy đủ" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
      {completenessCards(completeness).map((card) => {
        const on = active.includes(card.field);
        return (
          <button
            key={card.field}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(card.field)}
            className={`flex min-h-11 flex-col gap-1 rounded-xl border bg-surface p-4 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
              on ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]' : 'border-default'
            }`}
          >
            <span className="flex items-center gap-2 text-default">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[card.field]}
              </svg>
              <span className="text-xl font-bold">
                {card.have}/{card.total}
              </span>
            </span>
            <span className="text-base text-default">{card.label}</span>
            {card.note && <span className="text-sm text-muted">{card.note}</span>}
            <span
              role="progressbar"
              aria-label={card.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={card.percent}
              className="mt-1 block h-2 overflow-hidden rounded-full bg-surface-muted"
            >
              <span className="block h-full bg-primary transition-[width]" style={{ width: `${card.percent}%` }} />
            </span>
            <span className="text-sm text-muted">{on ? 'Đang lọc người còn thiếu — bấm để bỏ lọc' : 'Bấm để xem người còn thiếu'}</span>
          </button>
        );
      })}
    </section>
  );
}
