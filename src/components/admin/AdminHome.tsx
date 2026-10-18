'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { BADGE_KEY, visibleSections, type Overview } from '@/lib/admin/sections';

type AuditLine = { id: number; action: string; actor_name: string; member_name: string | null; created_at: string };

function when(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** The admin home: what needs doing now, a tile per area, and the last few changes. */
export function AdminHome() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<AuditLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/overview', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<Overview>) : Promise.reject()))
      .then(setOverview)
      .catch(() => setError('Không tải được danh sách việc cần làm. Các mục bên dưới vẫn dùng được.'));
    fetch('/api/audit?limit=5', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((page) => setRecent(page?.items ?? []))
      .catch(() => undefined);
  }, []);

  const tasks = overview?.items.filter((i) => i.kind === 'task') ?? [];
  const notices = overview?.items.filter((i) => i.kind === 'notice') ?? [];
  const badgeFor = (id: string) => {
    const key = BADGE_KEY[id];
    return key ? (overview?.items.find((i) => i.key === key)?.count ?? 0) : 0;
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-default">Quản trị</h1>

      <section aria-label="Cần làm" className="rounded-2xl border-default border bg-surface p-4">
        <h2 className="text-lg font-semibold text-default">Cần làm</h2>
        {error && (
          <p role="alert" className="mt-2 text-base text-danger">
            {error}
          </p>
        )}
        {!error && !overview && <p className="mt-2 text-base text-muted">Đang tải...</p>}
        {overview && tasks.length === 0 && <p className="mt-2 text-base text-muted">Không có việc nào cần làm.</p>}
        {tasks.length > 0 && (
          <ul className="mt-2 space-y-2">
            {tasks.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface-muted px-4 py-2 text-base text-default hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <span>{item.text}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {notices.length > 0 && (
          <ul className="mt-3 space-y-1 border-default border-t pt-3">
            {notices.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="inline-flex min-h-11 items-center text-base text-muted underline hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Các mục quản trị">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {visibleSections().map((s) => {
            const badge = badgeFor(s.id);
            return (
              <li key={s.id}>
                <Link
                  href={s.href}
                  className="relative flex min-h-28 h-full flex-col gap-1 rounded-2xl border-default border bg-surface p-4 text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <span className="text-primary">
                    <AdminIcon icon={s.icon} />
                  </span>
                  <span className="text-lg font-semibold">{s.label}</span>
                  <span className="text-sm text-muted">{s.hint}</span>
                  {badge > 0 && (
                    <span
                      aria-label={`${badge} đang chờ`}
                      className="absolute end-3 top-3 min-w-6 rounded-full bg-primary px-2 text-center text-sm font-semibold text-on-primary"
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {recent.length > 0 && (
        <section aria-label="Gần đây">
          <h2 className="text-lg font-semibold text-default">Gần đây</h2>
          <ul className="mt-2 divide-y divide-[var(--color-border)] rounded-2xl border-default border bg-surface">
            {recent.map((line) => (
              <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2 text-base text-default">
                <span>
                  {line.actor_name} · {line.action}
                  {line.member_name ? ` · ${line.member_name}` : ''}
                </span>
                <span className="text-sm text-muted">{when(line.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
