'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { formatBytes } from '@/lib/admin/backup';
import { PLATFORM_BADGE_KEY, visiblePlatformSections, type PlatformOverview } from '@/lib/platform/sections';

/** The superadmin home: what needs attention across all families, the platform's size, and a tile per area. */
export function PlatformHome() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/platform/overview', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<PlatformOverview>) : Promise.reject()))
      .then(setOverview)
      .catch(() => setError('Không tải được danh sách việc cần làm. Các mục bên dưới vẫn dùng được.'));
  }, []);

  const tasks = overview?.items.filter((i) => i.kind === 'task') ?? [];
  const n = overview?.numbers;
  const numbers: [string, string][] = n
    ? [
        ['Họ', `${n.trees}${n.trees_paused ? ` (${n.trees_paused} tạm ngưng)` : ''}`],
        ['Người trong cây', String(n.members)],
        ['Tài khoản', String(n.users)],
        ['Ảnh và tài liệu', formatBytes(n.media_bytes)],
      ]
    : [];
  const badgeFor = (id: string) => {
    const key = PLATFORM_BADGE_KEY[id];
    return key ? (overview?.items.find((i) => i.key === key)?.count ?? 0) : 0;
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-default">Quản trị nền tảng</h1>

      <section aria-label="Cần làm" className="rounded-2xl border-default border bg-surface p-4">
        <h2 className="text-lg font-semibold text-default">Cần làm</h2>
        {error && <p role="alert" className="mt-2 text-base text-danger">{error}</p>}
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
      </section>

      {numbers.length > 0 && (
        <section aria-label="Số liệu nền tảng">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {numbers.map(([label, value]) => (
              <div key={label} className="rounded-2xl border-default border bg-surface p-4">
                <dt className="text-base text-muted">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-default">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-label="Các mục nền tảng">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {visiblePlatformSections().map((s) => {
            const badge = badgeFor(s.id);
            return (
              <li key={s.id}>
                <Link
                  href={s.href}
                  className="relative flex h-full min-h-28 flex-col gap-1 rounded-2xl border-default border bg-surface p-4 text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <span className="text-primary">
                    <AdminIcon icon={s.icon} />
                  </span>
                  <span className="text-lg font-semibold">{s.label}</span>
                  <span className="text-sm text-muted">{s.hint}</span>
                  {badge > 0 && (
                    <span aria-label={`${badge} cần chú ý`} className="absolute end-3 top-3 min-w-6 rounded-full bg-primary px-2 text-center text-sm font-semibold text-on-primary">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
