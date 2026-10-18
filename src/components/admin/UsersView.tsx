'use client';

import { useCallback, useEffect, useState } from 'react';
import { LinkDialog, PasswordDialog } from '@/components/admin/UserDialogs';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { roleLabel, type AccountStatus, type Role } from '@/lib/auth/session';
import { buildUsersQuery, canApproveAll, lastLoginLabel, type AdminUser } from '@/lib/admin/users';

const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Chờ duyệt',
  active: 'Đang hoạt động',
  disabled: 'Đã vô hiệu hoá',
};
const STATUS_STYLE: Record<AccountStatus, string> = {
  pending: 'border border-[var(--color-text)] bg-surface text-default',
  active: 'bg-surface-muted text-default',
  disabled: 'bg-surface-muted text-danger',
};
const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-base text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]';
const button =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-base font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

type Pending =
  | { kind: 'status'; user: AdminUser; status: AccountStatus; title: string; message: string; confirm: string; danger: boolean }
  | { kind: 'role'; user: AdminUser; role: Role; title: string; message: string; confirm: string; danger: boolean }
  | { kind: 'approve-all'; ids: number[]; title: string; message: string; confirm: string; danger: boolean };

export function UsersView({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filters, setFilters] = useState({ q: '', status: '', role: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);
  const [linkFor, setLinkFor] = useState<AdminUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [ready, setReady] = useState(false);

  // ?trang-thai=pending (a link from the home's to-do box) pre-selects the status filter
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('trang-thai');
    if (status === 'pending' || status === 'active' || status === 'disabled') setFilters((f) => ({ ...f, status }));
    setReady(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const query = buildUsersQuery(filters);
      const response = await fetch(`/api/admin/users${query ? `?${query}` : ''}`, { credentials: 'include' });
      if (!response.ok) return setMessage({ kind: 'error', text: 'Không thể tải danh sách người dùng.' });
      setUsers((await response.json()) as AdminUser[]);
    } catch {
      setMessage({ kind: 'error', text: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => void load(), filters.q ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, ready, filters.q]);

  async function run(request: () => Promise<Response>, okText: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await request();
      if (response.status === 409) setMessage({ kind: 'error', text: 'Phải còn ít nhất một quản trị viên đang hoạt động.' });
      else if (!response.ok) setMessage({ kind: 'error', text: 'Không thể cập nhật. Vui lòng thử lại.' });
      else setMessage({ kind: 'ok', text: okText });
      await load();
    } catch {
      setMessage({ kind: 'error', text: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const patch = (id: number, body: object) =>
    fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  function askStatus(user: AdminUser, status: AccountStatus) {
    const texts: Record<string, [string, string, string, boolean]> = {
      active_from_pending: [`Duyệt ${user.full_name}?`, `${user.full_name} sẽ đăng nhập và xem được gia phả.`, 'Duyệt', false],
      disabled: [`Vô hiệu hoá ${user.full_name}?`, 'Tài khoản này sẽ bị đăng xuất ngay và không đăng nhập được nữa. Bạn có thể kích hoạt lại sau.', 'Vô hiệu hoá', true],
      active_from_disabled: [`Kích hoạt lại ${user.full_name}?`, 'Tài khoản này sẽ đăng nhập được trở lại.', 'Kích hoạt lại', false],
    };
    const [title, text, confirm, danger] = texts[status === 'disabled' ? 'disabled' : user.status === 'pending' ? 'active_from_pending' : 'active_from_disabled'];
    setPending({ kind: 'status', user, status, title, message: text, confirm, danger });
  }

  function askRole(user: AdminUser, role: Role) {
    setPending({
      kind: 'role',
      user,
      role,
      title: `Đổi ${user.full_name} thành ${roleLabel(role).toLowerCase()}?`,
      message: role === 'admin' ? 'Người này sẽ sửa được cây, duyệt đăng ký và đổi cài đặt.' : 'Người này sẽ chỉ còn xem và đề xuất chỉnh sửa.',
      confirm: 'Đổi vai trò',
      danger: role === 'member' && user.role === 'admin',
    });
  }

  function confirm() {
    if (!pending) return;
    if (pending.kind === 'status') void run(() => patch(pending.user.id, { status: pending.status }), 'Đã cập nhật tài khoản.');
    else if (pending.kind === 'role') void run(() => patch(pending.user.id, { role: pending.role }), 'Đã đổi vai trò.');
    else
      void run(
        () => fetch('/api/admin/users/approve', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: pending.ids }) }),
        `Đã duyệt ${pending.ids.length} tài khoản.`,
      );
  }

  const pendingIds = canApproveAll(users);

  return (
    <div className="space-y-6">
      <section aria-label="Tìm người dùng" className="flex flex-wrap gap-3">
        <label className="block min-w-[14rem] flex-1 text-base text-default">
          Tìm theo tên hoặc email
          <input type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Gõ tên, không cần dấu..." className={field} />
        </label>
        <label className="block w-full text-base text-default sm:w-48">
          Trạng thái
          <select aria-label="Lọc theo trạng thái" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={field}>
            <option value="">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
            <option value="active">Đang hoạt động</option>
            <option value="disabled">Đã vô hiệu hoá</option>
          </select>
        </label>
        <label className="block w-full text-base text-default sm:w-48">
          Vai trò
          <select aria-label="Lọc theo vai trò" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} className={field}>
            <option value="">Tất cả</option>
            <option value="member">{roleLabel('member')}</option>
            <option value="admin">{roleLabel('admin')}</option>
          </select>
        </label>
      </section>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-base ${message.kind === 'error' ? 'text-danger' : 'text-default'}`}>
          {message.text}
        </p>
      )}

      {pendingIds.length > 1 && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            setPending({ kind: 'approve-all', ids: pendingIds, title: `Duyệt ${pendingIds.length} tài khoản?`, message: 'Tất cả những người đang chờ duyệt trong danh sách này sẽ đăng nhập được.', confirm: 'Duyệt tất cả', danger: false })
          }
          className={`${button} bg-primary text-on-primary hover:opacity-90`}
        >
          Duyệt tất cả ({pendingIds.length})
        </button>
      )}

      <section aria-label="Danh sách người dùng">
        <h2 className="text-lg font-semibold text-default">Người dùng ({users.length})</h2>
        {isLoading ? (
          <p className="mt-3 text-base text-muted">Đang tải...</p>
        ) : users.length === 0 ? (
          <p className="mt-3 text-base text-muted">Không có ai khớp bộ lọc này.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {users.map((user) => (
              <li key={user.id} className="shadow-card rounded-xl border-default border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-[14rem] flex-1">
                    <p className="font-display break-words text-lg font-semibold text-default">
                      {user.full_name}
                      {user.id === currentUserId && <span className="ms-2 text-sm font-normal text-muted">(bạn)</span>}
                    </p>
                    <p className="break-all text-base text-muted">{user.email}</p>
                    <p className="mt-1 text-base text-default">
                      {user.member ? <>Là <strong>{user.member.name}</strong> trong cây</> : <span className="text-muted">Chưa liên kết với ai trong cây</span>}
                    </p>
                    <p className="text-base text-muted">Đăng nhập gần nhất: {lastLoginLabel(user.last_login_at, new Date())}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[user.status]}`}>{STATUS_LABEL[user.status]}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <label className="text-base text-default">
                    <span className="sr-only">Vai trò của {user.full_name}</span>
                    <select
                      value={user.role}
                      disabled={busy}
                      onChange={(e) => askRole(user, e.target.value as Role)}
                      className="min-h-11 rounded-lg border-default border bg-app px-2 text-base text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      <option value="member">{roleLabel('member')}</option>
                      <option value="admin">{roleLabel('admin')}</option>
                    </select>
                  </label>
                  {user.status === 'pending' && (
                    <button type="button" disabled={busy} onClick={() => askStatus(user, 'active')} className={`${button} bg-primary text-on-primary hover:opacity-90`}>
                      Duyệt
                    </button>
                  )}
                  {user.status === 'active' && (
                    <button type="button" disabled={busy} onClick={() => askStatus(user, 'disabled')} className={`${button} text-danger hover:underline`}>
                      Vô hiệu hoá
                    </button>
                  )}
                  {user.status === 'disabled' && (
                    <button type="button" disabled={busy} onClick={() => askStatus(user, 'active')} className={`${button} text-default hover:bg-surface-muted`}>
                      Kích hoạt lại
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => setPasswordFor(user)} className={`${button} text-default hover:bg-surface-muted`}>
                    Đặt lại mật khẩu
                  </button>
                  <button type="button" disabled={busy} onClick={() => setLinkFor(user)} className={`${button} text-default hover:bg-surface-muted`}>
                    {user.member ? 'Đổi liên kết' : 'Liên kết với người trong cây'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Thêm người dùng">
        <button type="button" aria-expanded={showCreate} onClick={() => setShowCreate(!showCreate)} className={`${button} border-default border text-default hover:bg-surface-muted`}>
          {showCreate ? 'Ẩn form thêm người dùng' : 'Thêm người dùng'}
        </button>
        {showCreate && <CreateForm onCreated={async () => { setMessage({ kind: 'ok', text: 'Đã tạo tài khoản.' }); await load(); }} />}
      </section>

      {pending && <ConfirmDialog title={pending.title} message={pending.message} confirmLabel={pending.confirm} danger={pending.danger} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)} />}
      {passwordFor && <PasswordDialog user={passwordFor} onClose={() => setPasswordFor(null)} />}
      {linkFor && <LinkDialog user={linkFor} onClose={() => setLinkFor(null)} onDone={() => { setLinkFor(null); setMessage({ kind: 'ok', text: 'Đã lưu liên kết.' }); void load(); }} />}
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim(), password, role }),
      });
      if (response.status === 409) return setError('Email này đã được dùng.');
      if (!response.ok) return setError('Không thể tạo. Kiểm tra email hợp lệ và mật khẩu từ 8 ký tự.');
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('member');
      await onCreated();
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
      <p className="text-base text-muted sm:col-span-2">Tài khoản tạo ở đây dùng được ngay, không cần duyệt — hợp để mời họ hàng khi đăng ký tự do đang đóng.</p>
      <label className="block text-base text-default">
        Họ tên
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
      </label>
      <label className="block text-base text-default">
        Email
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>
      <label className="block text-base text-default">
        Mật khẩu (từ 8 ký tự)
        <input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
      </label>
      <label className="block text-base text-default">
        Vai trò
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
          <option value="member">{roleLabel('member')}</option>
          <option value="admin">{roleLabel('admin')}</option>
        </select>
      </label>
      <div className="sm:col-span-2">
        {error && <p role="alert" className="mb-3 text-base text-danger">{error}</p>}
        <button type="submit" disabled={busy} className={`${button} bg-primary px-4 text-on-primary hover:opacity-90`}>
          {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
        </button>
      </div>
    </form>
  );
}
