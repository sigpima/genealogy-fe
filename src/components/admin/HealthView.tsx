'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { groupFindings, healthHeadline, type Finding } from '@/lib/admin/health';
import { focusHref } from '@/lib/search/search';

/** Probable typos in the tree's data, grouped; every person is a link to the tree focused on them. Read-only. */
export function HealthView() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/data-health', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ findings: Finding[] }>) : Promise.reject()))
      .then((body) => setFindings(body.findings))
      .catch(() => setError('Không kiểm tra được dữ liệu. Vui lòng thử lại.'));
  }, []);

  if (error) return <p role="alert" className="text-base text-danger">{error}</p>;
  if (!findings) return <p className="text-base text-muted">Đang kiểm tra dữ liệu...</p>;

  const groups = groupFindings(findings);
  return (
    <div className="space-y-6">
      <p role="status" className="rounded-2xl border-default border bg-surface p-4 text-lg font-semibold text-default">
        {healthHeadline(findings)}
      </p>
      <p className="text-base text-muted">Đây là gợi ý, không phải lỗi chắc chắn: chỉ sửa khi bạn xác nhận được. Trang này không tự sửa gì.</p>
      {groups.map((group) => (
        <section key={group.kind} aria-label={group.label} className="rounded-2xl border-default border bg-surface p-4">
          <h2 className="text-lg font-semibold text-default">
            {group.label} ({group.items.length})
          </h2>
          {group.hint && <p className="mt-1 text-base text-muted">{group.hint}</p>}
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {group.items.slice(0, 50).map((item, i) => (
              <li key={`${item.member_id ?? 'x'}-${i}`} className="flex flex-wrap items-center justify-between gap-x-3 py-1">
                <span className="text-base text-default">
                  {item.member_name && <strong>{item.member_name}</strong>}
                  {item.member_name ? ' — ' : ''}
                  {item.message}
                </span>
                {item.member_id !== null && (
                  <Link href={focusHref(item.member_id)} className="inline-flex min-h-11 items-center text-base text-primary underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
                    Mở trên cây
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {group.items.length > 50 && <p className="mt-2 text-base text-muted">… và {group.items.length - 50} chỗ khác.</p>}
        </section>
      ))}
    </div>
  );
}
