'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDismiss } from '@/components/common/useDismiss';
import { headerIconClass } from '@/components/layout/HeaderIconButton';
import type { CurrentUser } from '@/lib/auth/session';
import type { NotificationList } from '@/lib/calendar/calendar';

const REFRESH_MS = 5 * 60 * 1000;

/** The bell in the header: reminders created by the hourly job. Opening the list marks everything read. */
export function NotificationsBell({ user }: { user: CurrentUser | null }) {
  const [list, setList] = useState<NotificationList>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const signedIn = user !== null;

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { credentials: 'include' });
      if (response.ok) setList((await response.json()) as NotificationList);
    } catch {
      /* the bell just keeps what it had */
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [signedIn, load]);

  useDismiss(box, open, () => setOpen(false));

  if (!signedIn) return null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && list.unread > 0) {
      try {
        const response = await fetch('/api/notifications/read', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        // keep the unread highlight for this opening, but the count drops at once
        if (response.ok) setList((current) => ({ ...current, unread: 0 }));
      } catch {
        /* marking read is best effort */
      }
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={list.unread > 0 ? `Thông báo, ${list.unread} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        title="Thông báo"
        className={headerIconClass(open)}
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {list.unread > 0 && (
          <span className="absolute end-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-on-primary">
            {list.unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Thông báo" className="shadow-float absolute end-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border-default border bg-surface">
          {list.items.length === 0 ? (
            <p className="p-4 text-sm text-muted">Chưa có thông báo. Nhắc giỗ và sự kiện sẽ hiện ở đây.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[var(--color-border)] overflow-y-auto">
              {list.items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? '/lich'}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)] ${n.read ? '' : 'bg-surface-muted'}`}
                  >
                    <span className="block text-sm font-medium text-default">{n.title}</span>
                    {n.body && <span className="block text-xs text-muted">{n.body}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/lich" onClick={() => setOpen(false)} className="block border-default border-t px-4 py-3 text-sm font-medium text-primary hover:bg-surface-muted">
            Mở lịch giỗ
          </Link>
        </div>
      )}
    </div>
  );
}
