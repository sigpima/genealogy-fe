'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildEventsQuery, eventDetail, platformActionLabel, type PlatformEvent } from '@/lib/platform/log';
import type { PlatformTree } from '@/lib/platform/trees';

const PAGE = 50;
const KINDS: [string, string][] = [
  ['', 'Tất cả'],
  ['tree.', 'Các họ'],
  ['admin.', 'Quản trị viên'],
  ['support', 'Vào hỗ trợ'],
];

/** What the superadmin did to the families, newest first, filterable by kind, family and day. */
export function PlatformLogView() {
  const [action, setAction] = useState('');
  const [treeId, setTreeId] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [offset, setOffset] = useState(0);
  const [trees, setTrees] = useState<PlatformTree[]>([]);
  const [page, setPage] = useState<{ total: number; items: PlatformEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/trees', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<PlatformTree[]>) : []))
      .then(setTrees)
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    try {
      const query = buildEventsQuery({ action, treeId: treeId ? Number(treeId) : null, since, until }, offset, PAGE);
      const response = await fetch(`/api/platform/events?${query}`, { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      setPage(await response.json());
      setError(null);
    } catch {
      setError('Không tải được nhật ký. Vui lòng thử lại.');
    }
  }, [action, treeId, since, until, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const field = 'mt-1 block min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default';
  return (
    <div className="space-y-5">
      <p className="text-base text-muted">Những gì bạn đã làm với các họ: tạo, đổi tên, tạm ngưng, xoá, thay đổi quản trị viên và mỗi lần vào một họ để hỗ trợ.</p>
      <section aria-label="Lọc nhật ký nền tảng" className="space-y-3">
        <div role="group" aria-label="Loại" className="flex flex-wrap gap-2">
          {KINDS.map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={action === value}
              onClick={() => {
                setAction(value);
                setOffset(0);
              }}
              className={`min-h-11 rounded-full border px-4 text-base focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                action === value ? 'border-[var(--color-primary)] bg-primary font-semibold text-on-primary' : 'border-default bg-surface text-default hover:bg-surface-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-base text-default">
            Họ
            <select value={treeId} onChange={(e) => { setTreeId(e.target.value); setOffset(0); }} className={field}>
              <option value="">Tất cả các họ</option>
              {trees.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="text-base text-default">
            Từ ngày
            <input type="date" value={since} onChange={(e) => { setSince(e.target.value); setOffset(0); }} className={field} />
          </label>
          <label className="text-base text-default">
            Đến ngày
            <input type="date" value={until} onChange={(e) => { setUntil(e.target.value); setOffset(0); }} className={field} />
          </label>
        </div>
      </section>
      {error && <p role="alert" className="text-base text-danger">{error}</p>}
      {page && page.items.length === 0 && <p className="text-base text-muted">Chưa có dòng nhật ký nào.</p>}
      <ol className="space-y-3">
        {(page?.items ?? []).map((e) => {
          const detail = eventDetail(e);
          return (
            <li key={e.id} className="rounded-xl border-default border bg-surface p-4">
              <p className="text-base text-default">
                <b>{e.actor_name}</b> · {platformActionLabel(e.action)}
                {e.tree_name && <> · <span className="font-display">{e.tree_name}</span></>}
              </p>
              <p className="mt-0.5 text-sm text-muted">{new Date(e.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</p>
              {detail && <p className="mt-1 text-sm text-default">{detail}</p>}
            </li>
          );
        })}
      </ol>
      {page && page.total > PAGE && (
        <div className="flex items-center justify-between">
          <button type="button" className="min-h-11 rounded-lg px-3 text-base text-default hover:bg-surface-muted disabled:opacity-40" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            ← Mới hơn
          </button>
          <span className="text-sm text-muted">{offset + 1}–{Math.min(offset + PAGE, page.total)} / {page.total}</span>
          <button type="button" className="min-h-11 rounded-lg px-3 text-base text-default hover:bg-surface-muted disabled:opacity-40" disabled={offset + PAGE >= page.total} onClick={() => setOffset(offset + PAGE)}>
            Cũ hơn →
          </button>
        </div>
      )}
    </div>
  );
}
