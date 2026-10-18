'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PasswordDialog } from '@/components/admin/UserDialogs';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useDialogFocus } from '@/components/common/useDialogFocus';
import { lastLoginLabel } from '@/lib/admin/users';
import { adminStatusLabel, canDisable, promotable, type FamilyAdmin, type FamilyUser } from '@/lib/platform/admins';
import { treeErrorMessage, type PlatformTree } from '@/lib/platform/trees';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const plain =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

async function problem(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (response.status === 409 && typeof detail === 'string' && /at least one active admin/.test(detail)) return 'Họ phải còn ít nhất một quản trị viên đang hoạt động.';
  if (response.status === 409) return 'Email này đã có tài khoản.';
  return treeErrorMessage(response.status, detail);
}

/** The admins of one family, for the superadmin: add a new one, promote a family member, enable/disable, give a new password. */
export function AdminsDialog({ tree, onClose, onChanged }: { tree: PlatformTree; onClose: () => void; onChanged: () => void }) {
  const [admins, setAdmins] = useState<FamilyAdmin[] | null>(null);
  const [users, setUsers] = useState<FamilyUser[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggle, setToggle] = useState<FamilyAdmin | null>(null);
  const [passwordFor, setPasswordFor] = useState<FamilyAdmin | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [typed, setTyped] = useState('');
  const [promoteId, setPromoteId] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(boxRef);

  const load = useCallback(async () => {
    try {
      const [a, u] = await Promise.all([
        fetch(`/api/trees/${tree.id}/admins`, { credentials: 'include' }),
        fetch('/api/admin/users', { credentials: 'include', headers: { 'X-Tree-Id': String(tree.id) } }),
      ]);
      if (a.ok) setAdmins((await a.json()) as FamilyAdmin[]);
      if (u.ok) setUsers((await u.json()) as FamilyUser[]);
      if (!a.ok) setMessage({ kind: 'error', text: 'Không tải được danh sách quản trị viên.' });
    } catch {
      setMessage({ kind: 'error', text: 'Không thể kết nối tới máy chủ.' });
    }
  }, [tree.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // a confirmation or password dialog on top owns Esc: only close this one when it is the only dialog
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function call(request: () => Promise<Response>, ok: string, then?: (r: Response) => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await request();
      if (!response.ok) setMessage({ kind: 'error', text: await problem(response) });
      else {
        await then?.(response);
        await load();
        onChanged();
        setMessage({ kind: 'ok', text: ok });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setBusy(false);
      setToggle(null);
    }
  }

  const json = (method: string, body: object) => ({ method, credentials: 'include' as const, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  async function addNew(e: React.FormEvent) {
    e.preventDefault();
    await call(
      () => fetch(`/api/trees/${tree.id}/admins`, json('POST', { email: email.trim(), full_name: fullName.trim(), ...(typed ? { password: typed } : {}) })),
      'Đã thêm quản trị viên.',
      async (r) => {
        const body = (await r.json()) as { admin: FamilyAdmin; password: string | null };
        if (body.password) setCreated({ email: body.admin.email, password: body.password });
        setEmail('');
        setFullName('');
        setTyped('');
      },
    );
  }

  const candidates = promotable(users);

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Quản trị viên của ${tree.name}`}
        onClick={(e) => e.stopPropagation()}
        className="shadow-float flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border-default border bg-surface sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-default border-b px-5 py-3">
          <h2 className="font-display text-lg font-bold text-default">Quản trị viên · {tree.name}</h2>
          <button type="button" className={plain} onClick={onClose}>
            Đóng ✕
          </button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-base ${message.kind === 'error' ? 'text-danger' : 'text-default'}`}>
              {message.text}
            </p>
          )}
          {created && (
            <div role="status" aria-label="Mật khẩu của quản trị viên mới" className="rounded-xl border-default border p-3 text-base text-default">
              <p>
                Mật khẩu của <strong>{created.email}</strong> (chỉ hiện một lần, hãy gửi ngay):
              </p>
              <p className="mt-1 select-all rounded-lg bg-surface-muted p-2 text-lg font-semibold tracking-wide">{created.password}</p>
              <button type="button" className={`${plain} mt-1`} onClick={() => setCreated(null)}>
                Đã ghi lại, ẩn đi
              </button>
            </div>
          )}

          <section aria-label="Danh sách quản trị viên">
            {!admins && <p className="text-base text-muted">Đang tải...</p>}
            <ul className="space-y-3">
              {(admins ?? []).map((a) => (
                <li key={a.id} className="rounded-xl border-default border p-3">
                  <p className="text-base font-semibold text-default">
                    {a.full_name}{' '}
                    <span className="ms-1 rounded-full border-2 border-[var(--color-border)] px-2 py-0.5 text-sm font-semibold">{adminStatusLabel(a.status)}</span>
                  </p>
                  <p className="break-all text-base text-muted">{a.email}</p>
                  <p className="text-base text-muted">Đăng nhập gần nhất: {lastLoginLabel(a.last_login_at, new Date())}</p>
                  <div className="mt-1 flex flex-wrap gap-x-2">
                    <button type="button" className={plain} disabled={busy} onClick={() => setPasswordFor(a)}>
                      Đặt mật khẩu mới
                    </button>
                    {a.status === 'active' && canDisable(admins ?? [], a) && (
                      <button type="button" className={`${plain} !text-danger`} disabled={busy} onClick={() => setToggle(a)}>
                        Vô hiệu hoá
                      </button>
                    )}
                    {a.status !== 'active' && (
                      <button type="button" className={plain} disabled={busy} onClick={() => setToggle(a)}>
                        Kích hoạt lại
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <form onSubmit={addNew} aria-label="Thêm quản trị viên mới" className="space-y-2 rounded-xl border-default border p-3">
            <h3 className="text-base font-semibold text-default">Thêm quản trị viên mới</h3>
            <label className="block text-base text-default">
              Họ tên
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
            </label>
            <label className="block text-base text-default">
              Email
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            </label>
            <label className="block text-base text-default">
              Mật khẩu (để trống: tự tạo)
              <input value={typed} minLength={8} autoComplete="off" onChange={(e) => setTyped(e.target.value)} className={field} />
            </label>
            <button type="submit" disabled={busy} className={primary}>
              Thêm quản trị viên
            </button>
          </form>

          {candidates.length > 0 && (
            <form
              aria-label="Nâng một thành viên lên quản trị viên"
              className="space-y-2 rounded-xl border-default border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void call(() => fetch(`/api/trees/${tree.id}/admins`, json('POST', { user_id: Number(promoteId) })), 'Đã nâng lên quản trị viên.', async () => setPromoteId(''));
              }}
            >
              <h3 className="text-base font-semibold text-default">Hoặc nâng một người của họ này lên quản trị viên</h3>
              <label className="block text-base text-default">
                Chọn người
                <select required value={promoteId} onChange={(e) => setPromoteId(e.target.value)} className={field}>
                  <option value="">—</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={busy || !promoteId} className={primary}>
                Nâng lên quản trị viên
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
    {/* the nested dialogs are siblings of the overlay, not children: a tap on their backdrop must not reach the overlay's onClick */}
      {toggle && (
        <ConfirmDialog
          title={toggle.status === 'active' ? `Vô hiệu hoá ${toggle.full_name}?` : `Kích hoạt lại ${toggle.full_name}?`}
          message={toggle.status === 'active' ? 'Người này bị đăng xuất ngay và không đăng nhập được nữa. Họ vẫn còn ít nhất một quản trị viên khác.' : 'Người này đăng nhập và quản trị họ được trở lại.'}
          confirmLabel={toggle.status === 'active' ? 'Vô hiệu hoá' : 'Kích hoạt lại'}
          danger={toggle.status === 'active'}
          busy={busy}
          onConfirm={() => void call(() => fetch(`/api/trees/${tree.id}/admins/${toggle.id}`, json('PATCH', { status: toggle.status === 'active' ? 'disabled' : 'active' })), 'Đã cập nhật quản trị viên.')}
          onCancel={() => setToggle(null)}
        />
      )}
      {passwordFor && <PasswordDialog user={passwordFor} endpoint={`/api/trees/${tree.id}/admins/${passwordFor.id}/password`} onClose={() => setPasswordFor(null)} />}
    </>
  );
}
