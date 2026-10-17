'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  fieldLabel,
  formatFieldValue,
  kindLabel,
  requestErrorMessage,
  statusLabel,
  type ChangeRequest,
  type RequestPage,
} from '@/lib/requests/requests';
import { focusHref } from '@/lib/search/search';

const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const field =
  'mt-1 w-full rounded-lg border-default border bg-app px-3 py-2 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';

type Tab = 'pending' | 'closed';

export function RequestsView({ isAdmin, onUnauthorized }: { isAdmin: boolean; onUnauthorized: () => void }) {
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState<RequestPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/requests?status=${tab}&limit=100`, { credentials: 'include' });
      if (response.status === 401) return onUnauthorized();
      if (!response.ok) throw new Error(String(response.status));
      setPage((await response.json()) as RequestPage);
      setError(null);
    } catch {
      setError('Không tải được danh sách yêu cầu. Vui lòng thử lại.');
    }
  }, [tab, onUnauthorized]);

  useEffect(() => {
    setPage(null);
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-default">{isAdmin ? 'Yêu cầu chỉnh sửa' : 'Yêu cầu của tôi'}</h1>
        <p className="mt-1 text-sm text-muted">
          {isAdmin
            ? 'Thành viên đề xuất sửa/thêm thông tin; bạn xem bản cũ – bản mới rồi duyệt hoặc từ chối.'
            : 'Các đề xuất bạn đã gửi và kết quả. Muốn đề xuất mới, mở hồ sơ một người trên cây rồi bấm “Đề xuất chỉnh sửa”.'}
        </p>
      </div>
      <div role="tablist" aria-label="Trạng thái" className="flex border-default border-b">
        {(
          [
            ['pending', 'Chờ duyệt'],
            ['closed', 'Đã xử lý'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 border-b-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
              tab === id ? 'border-[var(--color-primary)] text-primary' : 'border-transparent text-muted hover:text-default'
            }`}
          >
            {label}
            {id === 'pending' && tab === 'pending' && page ? ` (${page.total})` : ''}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {page && page.items.length === 0 && (
        <p className="text-sm text-muted">{tab === 'pending' ? 'Không có yêu cầu nào đang chờ.' : 'Chưa có yêu cầu nào được xử lý.'}</p>
      )}
      <ul className="space-y-3">
        {(page?.items ?? []).map((request) => (
          <li key={request.id}>
            <RequestCard request={request} isAdmin={isAdmin} onChanged={load} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function RequestCard({ request, isAdmin, onChanged }: { request: ChangeRequest; isAdmin: boolean; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(action: 'approve' | 'reject' | 'cancel') {
    if (action === 'reject' && !note.trim()) {
      setMessage('Hãy ghi lý do từ chối.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/requests/${request.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setMessage(requestErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail));
        return;
      }
      await onChanged();
    } catch {
      setMessage('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  const pending = request.status === 'pending';
  const badge =
    request.status === 'approved' ? 'bg-primary text-on-primary' : pending ? 'bg-surface-muted text-primary' : 'bg-surface-muted text-muted';
  return (
    <article className="rounded-xl border-default border bg-surface p-4" aria-label={`Yêu cầu ${request.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-default">
            {kindLabel(request.kind)} ·{' '}
            {request.member_id !== null ? (
              <Link href={focusHref(request.member_id)} className="font-display text-primary underline">
                {request.member_name}
              </Link>
            ) : (
              <span className="font-display">{request.member_name} (đã bị xoá)</span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {isAdmin ? `${request.requester.name} · ` : ''}
            {formatTime(request.created_at)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge}`}>{statusLabel(request.status)}</span>
      </div>

      {request.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm text-default">{request.message}</p>}

      {request.diff.length > 0 && (
        <table className="mt-3 w-full border-collapse text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="py-1 pe-3 font-semibold">Thông tin</th>
              <th scope="col" className="py-1 pe-3 font-semibold">{request.kind === 'add_child' ? '' : 'Hiện tại'}</th>
              <th scope="col" className="py-1 font-semibold">{request.kind === 'add_child' ? 'Người con mới' : 'Đề xuất'}</th>
            </tr>
          </thead>
          <tbody>
            {request.diff.map((row) => (
              <tr key={row.field} className="border-default border-t align-top">
                <td className="py-1.5 pe-3 text-muted">{fieldLabel(row.field)}</td>
                <td className="py-1.5 pe-3 text-default">
                  {request.kind === 'add_child' ? '' : formatFieldValue(row.field, row.old)}
                  {row.stale && <span className="ms-2 text-xs font-semibold text-danger">đã đổi từ lúc gửi</span>}
                </td>
                <td className="py-1.5 font-medium text-default">{formatFieldValue(row.field, row.new)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {request.stale && pending && isAdmin && (
        <p className="mt-2 text-xs text-danger">Thông tin của người này đã thay đổi sau khi yêu cầu được gửi; duyệt sẽ ghi đè bằng giá trị đề xuất.</p>
      )}

      {!pending && (
        <p className="mt-3 text-xs text-muted">
          {request.reviewer ? `${request.reviewer.name} · ` : ''}
          {request.reviewed_at ? formatTime(request.reviewed_at) : ''}
          {request.review_note ? ` — “${request.review_note}”` : ''}
          {request.result_member_id !== null && (
            <>
              {' · '}
              <Link href={focusHref(request.result_member_id)} className="text-primary underline">
                xem người con đã thêm
              </Link>
            </>
          )}
        </p>
      )}

      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}

      {pending && isAdmin && (
        <div className="mt-3">
          {mode === 'idle' ? (
            <div className="flex flex-wrap gap-x-2">
              <button type="button" className={primary} onClick={() => setMode('approve')}>
                Duyệt
              </button>
              <button type="button" className={danger} onClick={() => setMode('reject')}>
                Từ chối
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm">
                <span className="text-xs text-muted">{mode === 'reject' ? 'Lý do từ chối (bắt buộc)' : 'Ghi chú (tuỳ chọn)'}</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Ghi chú duyệt" className={field} />
              </label>
              <div className="mt-2 flex gap-x-2">
                <button type="button" className={primary} disabled={busy} onClick={() => void act(mode)}>
                  {mode === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
                </button>
                <button
                  type="button"
                  className={ghost}
                  onClick={() => {
                    setMode('idle');
                    setNote('');
                    setMessage(null);
                  }}
                >
                  Huỷ
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {pending && !isAdmin && (
        <div className="mt-3">
          <button type="button" className={danger} disabled={busy} onClick={() => void act('cancel')}>
            Rút lại yêu cầu
          </button>
        </div>
      )}
    </article>
  );
}
