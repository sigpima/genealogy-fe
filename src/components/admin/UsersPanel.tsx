'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  roleLabel,
  type AccountStatus,
  type CurrentUser,
  type Role,
} from '@/lib/auth/session';

type AdminUser = CurrentUser & { created_at: string };

const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Chờ duyệt',
  active: 'Đang hoạt động',
  disabled: 'Đã vô hiệu hoá',
};

const STATUS_STYLE: Record<AccountStatus, string> = {
  pending: 'bg-secondary text-on-secondary',
  active: 'bg-surface-muted text-default',
  disabled: 'bg-surface-muted text-danger',
};

const fieldClass =
  'mt-1 w-full rounded-lg border-default border bg-app px-3 py-2 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]';
const smallButton =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

export function UsersPanel({
  currentUserId,
  onPendingCount,
}: {
  currentUserId: number;
  onPendingCount: (n: number) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      });
      if (!response.ok) {
        setError('Không thể tải danh sách người dùng.');
        return;
      }
      const list = (await response.json()) as AdminUser[];
      setUsers(list);
      onPendingCount(list.filter((u) => u.status === 'pending').length);
      setError(null);
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setIsLoading(false);
    }
  }, [onPendingCount]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchUser(
    id: number,
    body: { role?: Role; status?: AccountStatus },
  ) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // Reload first: load() clears the error, so the message must be set after it.
      await load();
      if (response.status === 409) {
        setError('Phải còn ít nhất một quản trị viên đang hoạt động.');
      } else if (!response.ok) {
        setError('Không thể cập nhật. Vui lòng thử lại.');
      }
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusyId(null);
    }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          password,
          role,
        }),
      });
      if (response.status === 409) {
        setCreateError('Email này đã được dùng.');
        return;
      }
      if (!response.ok) {
        setCreateError(
          'Không thể tạo. Kiểm tra email hợp lệ và mật khẩu từ 8 ký tự.',
        );
        return;
      }
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('member');
      await load();
    } catch {
      setCreateError('Không thể kết nối tới máy chủ.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="users-heading">
        <h2
          id="users-heading"
          className="text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          Người dùng ({users.length})
        </h2>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {isLoading ? (
          <p className="mt-3 text-sm text-muted">Đang tải...</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {users.map((user) => (
              <li
                key={user.id}
                className="shadow-card rounded-xl border-default border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate font-semibold text-default">
                      {user.full_name}
                      {user.id === currentUserId && (
                        <span className="ms-2 text-xs font-normal text-muted">
                          (bạn)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted">{user.email}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[user.status]}`}
                  >
                    {STATUS_LABEL[user.status]}
                  </span>
                  <label className="text-xs text-muted">
                    <span className="sr-only">
                      Vai trò của {user.full_name}
                    </span>
                    <select
                      value={user.role}
                      disabled={busyId === user.id}
                      onChange={(e) =>
                        void patchUser(user.id, {
                          role: e.target.value as Role,
                        })
                      }
                      className="min-h-11 rounded-lg border-default border bg-app px-2 text-sm text-default focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      <option value="member">{roleLabel('member')}</option>
                      <option value="admin">{roleLabel('admin')}</option>
                    </select>
                  </label>
                  {user.status === 'pending' && (
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      onClick={() =>
                        void patchUser(user.id, { status: 'active' })
                      }
                      className={`${smallButton} bg-primary text-on-primary hover:opacity-90`}
                    >
                      Duyệt
                    </button>
                  )}
                  {user.status === 'active' && (
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      onClick={() =>
                        void patchUser(user.id, { status: 'disabled' })
                      }
                      className={`${smallButton} text-danger hover:underline`}
                    >
                      Vô hiệu hoá
                    </button>
                  )}
                  {user.status === 'disabled' && (
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      onClick={() =>
                        void patchUser(user.id, { status: 'active' })
                      }
                      className={`${smallButton} text-default hover:bg-surface-muted`}
                    >
                      Kích hoạt lại
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="create-heading">
        <h2
          id="create-heading"
          className="text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          Thêm người dùng
        </h2>
        <p className="mt-2 text-sm text-muted">
          Tài khoản tạo ở đây dùng được ngay, không cần duyệt — hợp để mời họ
          hàng khi đăng ký tự do đang đóng.
        </p>
        <form onSubmit={createUser} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">
            Họ tên
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-xs text-muted">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-xs text-muted">
            Mật khẩu (từ 8 ký tự)
            <input
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-xs text-muted">
            Vai trò
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={fieldClass}
            >
              <option value="member">{roleLabel('member')}</option>
              <option value="admin">{roleLabel('admin')}</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            {createError && (
              <p role="alert" className="mb-3 text-sm text-danger">
                {createError}
              </p>
            )}
            <button
              type="submit"
              disabled={isCreating}
              className={`${smallButton} bg-primary px-4 text-on-primary hover:opacity-90`}
            >
              {isCreating ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
