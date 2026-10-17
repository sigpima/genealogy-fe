'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { actionLabel, changeLines, type AuditPage } from '@/lib/requests/requests';
import { focusHref } from '@/lib/search/search';

const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40';
const PAGE = 50;

/** The change log of the family (admins): who changed what and when. `?member=<id>` narrows it to one person. */
export function AuditView({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [memberId, setMemberId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('member');
    setMemberId(raw && /^\d+$/.test(raw) ? Number(raw) : null);
    setReady(true);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (memberId !== null) params.set('member_id', String(memberId));
    try {
      const response = await fetch(`/api/audit?${params}`, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) return onUnauthorized();
      if (!response.ok) throw new Error(String(response.status));
      setPage((await response.json()) as AuditPage);
      setError(null);
    } catch {
      setError('Không tải được nhật ký. Vui lòng thử lại.');
    }
  }, [memberId, offset, onUnauthorized]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-default">Nhật ký thay đổi</h1>
        <p className="mt-1 text-sm text-muted">
          Mọi thay đổi trên gia phả: ai làm, lúc nào, từ giá trị nào sang giá trị nào.
          {memberId !== null && (
            <>
              {' '}
              Đang lọc theo một người.{' '}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => {
                  setMemberId(null);
                  setOffset(0);
                  window.history.replaceState(null, '', window.location.pathname);
                }}
              >
                Xem tất cả
              </button>
            </>
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {page && page.items.length === 0 && <p className="text-sm text-muted">Chưa có thay đổi nào được ghi.</p>}
      <ol className="space-y-3">
        {(page?.items ?? []).map((entry) => {
          const lines = changeLines(entry.changes);
          return (
            <li key={entry.id} className="rounded-xl border-default border bg-surface p-4">
              <p className="text-sm text-default">
                <b>{entry.actor_name}</b> · {actionLabel(entry.action)}
                {entry.member_name && (
                  <>
                    {' · '}
                    {entry.member_id !== null && entry.action !== 'member.delete' ? (
                      <Link href={focusHref(entry.member_id)} className="font-display text-primary underline">
                        {entry.member_name}
                      </Link>
                    ) : (
                      <span className="font-display">{entry.member_name}</span>
                    )}
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {new Date(entry.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                {entry.request_id !== null && ` · theo yêu cầu #${entry.request_id}`}
                {typeof entry.details?.via === 'string' && ` · qua ${entry.details.via === 'csv' ? 'file CSV' : entry.details.via}`}
              </p>
              {lines.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-default">
                  {lines.slice(0, 12).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  {lines.length > 12 && <li className="text-muted">… và {lines.length - 12} thay đổi khác</li>}
                </ul>
              )}
              {typeof entry.details?.note === 'string' && entry.details.note && (
                <p className="mt-2 text-xs text-muted">Ghi chú: “{entry.details.note}”</p>
              )}
            </li>
          );
        })}
      </ol>
      {page && page.total > PAGE && (
        <div className="flex items-center justify-between">
          <button type="button" className={ghost} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            ← Mới hơn
          </button>
          <span className="text-xs text-muted">
            {offset + 1}–{Math.min(offset + PAGE, page.total)} / {page.total}
          </span>
          <button type="button" className={ghost} disabled={offset + PAGE >= page.total} onClick={() => setOffset(offset + PAGE)}>
            Cũ hơn →
          </button>
        </div>
      )}
    </div>
  );
}
