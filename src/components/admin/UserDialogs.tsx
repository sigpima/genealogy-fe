'use client';

import { useEffect, useState } from 'react';
import { PersonPicker } from '@/components/common/PersonPicker';
import type { AdminUser } from '@/lib/admin/users';

const shell = 'fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4';
const box = 'shadow-float w-full max-w-md rounded-t-2xl border-default border bg-surface p-5 sm:rounded-2xl';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const plain =
  'min-h-11 rounded-lg border-default border px-4 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** Reset a password: the admin lets the app generate one or types one; the result is shown once. */
export function PasswordDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEscape(onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typed ? { password: typed } : {}),
      });
      if (!response.ok) {
        setError(response.status === 422 ? 'Mật khẩu phải từ 8 ký tự.' : 'Không đặt lại được. Vui lòng thử lại.');
        return;
      }
      setResult(((await response.json()) as { password: string }).password);
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={shell} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Đặt lại mật khẩu cho ${user.full_name}`} onClick={(e) => e.stopPropagation()} className={box}>
        <h2 className="font-display text-lg font-bold text-default">Đặt lại mật khẩu</h2>
        <p className="mt-1 text-base text-muted">{user.full_name} · {user.email}</p>
        {result === null ? (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-base text-default">
              Mật khẩu mới (để trống: tự tạo)
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                minLength={8}
                className="mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>
            {error && <p role="alert" className="text-base text-danger">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className={plain}>Huỷ</button>
              <button type="submit" disabled={busy} className={primary}>{busy ? 'Đang đặt...' : 'Đặt lại mật khẩu'}</button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-3">
            <p role="status" className="rounded-lg bg-surface-muted p-3 text-lg font-semibold tracking-wide text-default select-all" aria-label="Mật khẩu mới">
              {result}
            </p>
            <p className="text-base text-danger">Chỉ hiện một lần. Hãy gửi cho {user.full_name} ngay; sau khi đóng sẽ không xem lại được.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={plain}
                onClick={() => {
                  void navigator.clipboard?.writeText(result).then(() => setCopied(true)).catch(() => undefined);
                }}
              >
                {copied ? 'Đã chép' : 'Chép mật khẩu'}
              </button>
              <button type="button" onClick={onClose} className={primary}>Đã ghi lại, đóng</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Link an account to a person of the tree (display only), or remove the link. */
export function LinkDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEscape(onClose);

  async function save(memberId: number | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (response.status === 409) return setError('Người này đã được liên kết với một tài khoản khác.');
      if (!response.ok) return setError('Không lưu được. Vui lòng thử lại.');
      onDone();
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={shell} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Liên kết ${user.full_name} với một người trong cây`} onClick={(e) => e.stopPropagation()} className={box}>
        <h2 className="font-display text-lg font-bold text-default">Liên kết với người trong cây</h2>
        <p className="mt-1 text-base text-muted">
          Tài khoản của {user.full_name} là ai trong gia phả? Chỉ để hiển thị trong danh sách này.
        </p>
        {user.member && (
          <p className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-base text-default">
            <span>Hiện liên kết: {user.member.name}</span>
            <button type="button" disabled={busy} onClick={() => void save(null)} className="min-h-11 px-2 text-danger underline">
              Bỏ liên kết
            </button>
          </p>
        )}
        <div className="mt-3">
          <PersonPicker label="Tìm người trong cây" placeholder="Gõ tên người..." onPick={(p) => void save(p.id)} />
        </div>
        {error && <p role="alert" className="mt-2 text-base text-danger">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={plain}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
