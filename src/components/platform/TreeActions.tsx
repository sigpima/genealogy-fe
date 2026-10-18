'use client';

import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useDialogFocus } from '@/components/common/useDialogFocus';
import { canDelete, deleteSummary } from '@/lib/platform/lifecycle';
import { enterFamily, treeErrorMessage, type PlatformTree } from '@/lib/platform/trees';

const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const dangerText =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-base text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

async function problem(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return treeErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail);
}

/** Pause / resume (behind a confirmation) and, for a paused family only, delete (behind a dialog that asks for the slug). */
export function TreeActions({ tree, onChanged, onError }: { tree: PlatformTree; onChanged: (message: string) => Promise<void>; onError: (message: string) => void }) {
  const [asking, setAsking] = useState<'pause' | 'resume' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, ok: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/trees/${tree.id}/${path}`, { method: 'POST', credentials: 'include' });
      if (!response.ok) return onError(await problem(response));
      await onChanged(ok);
    } catch {
      onError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
      setAsking(null);
    }
  }

  return (
    <>
      {tree.status === 'active' ? (
        <button type="button" className={ghost} disabled={busy} onClick={() => setAsking('pause')}>
          Tạm ngưng
        </button>
      ) : (
        <>
          <button type="button" className={ghost} disabled={busy} onClick={() => setAsking('resume')}>
            Kích hoạt lại
          </button>
          <button type="button" className={dangerText} disabled={busy} onClick={() => setAsking('delete')}>
            Xoá họ
          </button>
        </>
      )}
      {asking === 'pause' && (
        <ConfirmDialog
          title={`Tạm ngưng ${tree.name}?`}
          message="Mọi người của họ này sẽ bị đăng xuất ngay và không đăng nhập được. Khách, link lịch và thiệp mời của họ cũng ngừng hoạt động, bộ nhắc việc bỏ qua họ này. Không mất dữ liệu: kích hoạt lại là mọi thứ trở lại."
          confirmLabel="Tạm ngưng"
          danger
          busy={busy}
          onConfirm={() => void post('pause', `Đã tạm ngưng ${tree.name}.`)}
          onCancel={() => setAsking(null)}
        />
      )}
      {asking === 'resume' && (
        <ConfirmDialog
          title={`Kích hoạt lại ${tree.name}?`}
          message="Mọi người của họ này đăng nhập được trở lại; link lịch và thiệp mời hoạt động lại."
          confirmLabel="Kích hoạt lại"
          busy={busy}
          onConfirm={() => void post('resume', `Đã kích hoạt lại ${tree.name}.`)}
          onCancel={() => setAsking(null)}
        />
      )}
      {asking === 'delete' && (
        <DeleteTreeDialog
          tree={tree}
          onCancel={() => setAsking(null)}
          onDeleted={async () => {
            setAsking(null);
            await onChanged(`Đã xoá ${tree.name}.`);
          }}
          onError={onError}
        />
      )}
    </>
  );
}

function DeleteTreeDialog({ tree, onCancel, onDeleted, onError }: { tree: PlatformTree; onCancel: () => void; onDeleted: () => Promise<void>; onError: (m: string) => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(boxRef);

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/trees/${tree.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: typed.trim() }),
      });
      if (!response.ok) return onError(await problem(response));
      await onDeleted();
    } catch {
      onError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Xoá hẳn ${tree.name}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        className="shadow-float w-full max-w-md rounded-t-2xl border-default border bg-surface p-5 sm:rounded-2xl"
      >
        <h2 className="font-display text-lg font-bold text-default">Xoá hẳn {tree.name}?</h2>
        <p className="mt-2 text-base text-default">
          Sẽ mất vĩnh viễn: {deleteSummary(tree)} <strong>Không thể khôi phục.</strong>
        </p>
        <p className="mt-2 text-base text-default">
          Nên{' '}
          <button
            type="button"
            className="inline min-h-11 underline"
            onClick={async () => {
              // the export is of the family the superadmin is acting on: switching into it is logged like any entry
              if (await enterFamily(tree.id)) window.open('/api/export/data.json', '_blank', 'noreferrer');
              else onError('Không ghi được nhật ký nên chưa tải được. Vui lòng thử lại.');
            }}
          >
            tải dữ liệu JSON của họ này
          </button>{' '}
          trước.
        </p>
        <label className="mt-4 block text-base text-default">
          Gõ lại đường dẫn <code className="rounded bg-surface-muted px-1">{tree.slug}</code> để xác nhận
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default focus:border-[var(--color-primary)] focus:outline-none"
          />
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border-default border px-4 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
            Huỷ
          </button>
          <button
            type="button"
            disabled={busy || !canDelete(tree, typed)}
            onClick={() => void remove()}
            className="min-h-11 rounded-lg bg-[var(--color-danger)] px-4 text-base font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40"
          >
            {busy ? 'Đang xoá...' : 'Xoá hẳn'}
          </button>
        </div>
      </div>
    </div>
  );
}
