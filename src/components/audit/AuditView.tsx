'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { actorBadge, buildAuditQuery, KIND_LABELS, kindOfAction, type AuditKind } from '@/lib/admin/audit';
import { actionLabel, changeLines, type AuditPage } from '@/lib/requests/requests';
import { focusHref } from '@/lib/search/search';

const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40';
const PAGE = 50;

/** The change log of the family (admins): who changed what and when. `?member=<id>` narrows it to one person. */
export function AuditView({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [memberId, setMemberId] = useState<number | null>(null);
  const [kind, setKind] = useState('');
  const [actorId, setActorId] = useState<number | null>(null);
  const [actors, setActors] = useState<{ id: number; name: string; role: string }[]>([]);
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [ready, setReady] = useState(false);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const raw = query.get('member');
    setMemberId(raw && /^\d+$/.test(raw) ? Number(raw) : null);
    const loai = query.get('loai');
    if (loai && loai in KIND_LABELS) setKind(loai);
    setSince(query.get('tu') ?? '');
    setUntil(query.get('den') ?? '');
    setReady(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/audit?${buildAuditQuery({ kind, since, until, memberId, actorId }, offset, PAGE)}`, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) return onUnauthorized();
      if (!response.ok) throw new Error(String(response.status));
      setPage((await response.json()) as AuditPage);
      setError(null);
    } catch {
      setError('Không tải được nhật ký. Vui lòng thử lại.');
    }
  }, [memberId, kind, since, until, actorId, offset, onUnauthorized]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // who has made entries in this family (for the "Người thực hiện" filter); the log still works without it
  useEffect(() => {
    fetch('/api/audit/actors', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ id: number; name: string; role: string }[]>) : []))
      .then(setActors)
      .catch(() => undefined);
  }, []);

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
      <section aria-label="Lọc nhật ký" className="space-y-3">
        <div role="group" aria-label="Loại sự kiện" className="flex flex-wrap gap-2">
          {[['', 'Tất cả'], ...Object.entries(KIND_LABELS)].map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setOffset(0);
              }}
              className={`min-h-11 rounded-full border px-4 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                kind === value ? 'border-[var(--color-primary)] bg-primary font-semibold text-on-primary' : 'border-default bg-surface text-default hover:bg-surface-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {actors.length > 0 && (
            <label className="text-base text-default">
              Người thực hiện
              <select
                value={actorId ?? ''}
                onChange={(e) => {
                  setActorId(e.target.value ? Number(e.target.value) : null);
                  setOffset(0);
                }}
                className="mt-1 block min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default"
              >
                <option value="">Tất cả</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name}
                    {actorBadge(actor.role) ? ` (${actorBadge(actor.role)})` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-base text-default">
            Từ ngày
            <input type="date" value={since} onChange={(e) => { setSince(e.target.value); setOffset(0); }} className="mt-1 block min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default" />
          </label>
          <label className="text-base text-default">
            Đến ngày
            <input type="date" value={until} onChange={(e) => { setUntil(e.target.value); setOffset(0); }} className="mt-1 block min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default" />
          </label>
        </div>
      </section>
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
              <p className="text-base text-default">
                {kindOfAction(entry.action) === 'security' && (
                  <span className="me-2 rounded-full border-2 border-[var(--color-danger)] px-2 py-0.5 text-sm font-semibold text-default">{KIND_LABELS.security as AuditKind}</span>
                )}
                <b>{entry.actor_name}</b>
                {actorBadge(entry.actor_role) && (
                  <span className="ms-2 rounded-full border border-[var(--color-text)] px-2 py-0.5 text-sm font-medium text-default">{actorBadge(entry.actor_role)}</span>
                )}{' '}
                · {actionLabel(entry.action)}
                {entry.member_name && (
                  <>
                    {' · '}
                    {entry.member_id !== null && entry.action !== 'member.delete' ? (
                      <Link href={focusHref(entry.member_id)} className="font-display inline-flex min-h-11 min-w-11 items-center justify-center text-primary underline">
                        {entry.member_name}
                      </Link>
                    ) : (
                      <span className="font-display">{entry.member_name}</span>
                    )}
                  </>
                )}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {new Date(entry.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                {entry.request_id !== null && ` · theo yêu cầu #${entry.request_id}`}
                {typeof entry.details?.email === 'string' && ` · ${entry.details.email}`}
                {typeof entry.details?.via === 'string' && ` · qua ${entry.details.via === 'csv' ? 'file CSV' : entry.details.via}`}
              </p>
              {lines.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-default">
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
