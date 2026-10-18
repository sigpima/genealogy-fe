'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { acceptErrorMessage, inviteErrorMessage, type InvitePreview } from '@/lib/invites/invites';
import type { CurrentUser } from '@/lib/auth/session';

const field =
  'mt-1 h-11 w-full rounded-lg border-default border bg-app px-3 text-base text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]';

function dateLabel(iso: string): string {
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return d.toLocaleDateString('vi-VN');
}

/** The page a relative lands on from an invitation link: who they are invited as, and a small form to make their account. Public: the token is the access control. */
export function InviteView() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) return setProblem(inviteErrorMessage(response.status));
        const body = (await response.json()) as InvitePreview;
        setPreview(body);
        setForm((f) => ({ ...f, name: body.person }));
      })
      .catch(() => !cancelled && setProblem(inviteErrorMessage(0)));
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError('Mật khẩu cần từ 8 ký tự trở lên.');
    if (form.password !== form.confirm) return setError('Hai mật khẩu chưa giống nhau.');
    setBusy(true);
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email.trim(), password: form.password, full_name: form.name.trim() || undefined }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        return setError(acceptErrorMessage(response.status, typeof body?.detail === 'string' ? body.detail : undefined));
      }
      const user = (await response.json()) as CurrentUser;
      router.replace(user.member ? `/?focus=${user.member.id}` : '/');
    } catch {
      setError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-4 py-10">
      <div className="shadow-card w-full max-w-md rounded-2xl border-default border bg-surface p-6">
        {problem ? (
          <>
            <h1 className="font-display text-2xl font-bold text-default">Lời mời không dùng được</h1>
            <p role="alert" className="mt-3 text-base text-default">
              {problem}
            </p>
          </>
        ) : !preview ? (
          <p className="text-base text-muted">Đang mở lời mời…</p>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="font-display text-2xl font-bold text-default">Lời mời vào gia phả</h1>
            <p className="mt-3 text-base text-default">
              Bạn được mời vào gia phả <strong>{preview.family}</strong> với tư cách <strong>{preview.person}</strong>.
            </p>
            <p className="mt-1 text-sm text-muted">Link có hiệu lực đến {dateLabel(preview.expires_at)}.</p>

            <label className="mt-5 block text-base text-default">
              Họ tên hiển thị
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" className={field} />
            </label>
            <label className="mt-3 block text-base text-default">
              Email
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" className={field} />
            </label>
            <label className="mt-3 block text-base text-default">
              Mật khẩu
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" aria-describedby="invite-password-hint" className={field} />
            </label>
            <p id="invite-password-hint" className="mt-1 text-sm text-muted">
              Từ 8 ký tự trở lên.
            </p>
            <label className="mt-3 block text-base text-default">
              Nhập lại mật khẩu
              <input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" className={field} />
            </label>

            {error && (
              <p role="alert" className="mt-3 text-base text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 min-h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
            >
              {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản và vào xem gia phả'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
