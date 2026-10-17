'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatDayMonth, relativeDays, type CalendarItem } from '@/lib/calendar/calendar';

const SHOWN = 3;

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** "Sắp tới": the next giỗ and events (30 days) in a corner of the tree page. Hidden when there is nothing, or no access. */
export function UpcomingStrip() {
  const [items, setItems] = useState<CalendarItem[]>([]);

  useEffect(() => {
    fetch('/api/calendar/upcoming?days=30', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ items: CalendarItem[] }>) : { items: [] }))
      .then((body) => setItems(body.items))
      .catch(() => undefined);
  }, []);

  if (items.length === 0) return null;
  const today = localToday();
  return (
    <aside
      aria-label="Sắp tới"
      className="shadow-float absolute right-4 top-4 z-20 hidden w-64 rounded-xl border-default border bg-glass p-3 backdrop-blur-md md:block"
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Sắp tới</h2>
      <ul className="mt-1.5 space-y-1">
        {items.slice(0, SHOWN).map((item, i) => (
          <li key={i} className="flex items-baseline justify-between gap-x-2 text-xs text-default">
            <span className="min-w-0 truncate">
              <b className="font-semibold">{formatDayMonth(item.date)}</b> {item.title}
            </span>
            <span className="shrink-0 text-muted">{relativeDays(item.date, today)}</span>
          </li>
        ))}
      </ul>
      <Link href="/lich" className="mt-1.5 block text-xs font-medium text-primary hover:underline">
        {items.length > SHOWN ? `Xem tất cả ${items.length} →` : 'Mở lịch giỗ →'}
      </Link>
    </aside>
  );
}
