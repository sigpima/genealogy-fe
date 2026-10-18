'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { inviteStatusLabel, type Invitation } from '@/lib/invites/invites';

const STATUS_STYLE: Record<Invitation['status'], string> = {
  pending: 'border border-[var(--color-text)] bg-surface text-default',
  used: 'border border-[var(--color-border)] bg-surface-muted text-default',
  expired: 'border border-[var(--color-border)] bg-surface text-muted',
  revoked: 'border border-[var(--color-border)] bg-surface text-muted',
};

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return d.toLocaleDateString('vi-VN');
}

/** The links an admin has sent: who each is for, whether it is still open, and "Thu hồi" for the ones that are. */
export function InvitationsPanel() {
  const [items, setItems] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/invitations', { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      setItems((await response.json()) as Invitation[]);
      setError(null);
    } catch {
      setError('Không tải được danh sách lời mời.');
      setItems((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(invite: Invitation) {
    setBusy(true);
    try {
      const response = await fetch(`/api/invitations/${invite.id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) setError('Không thu hồi được. Vui lòng thử lại.');
      else await load();
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
      setRevoking(null);
    }
  }

  return (
    <section aria-label="Lời mời" className="space-y-3">
      <h2 className="text-lg font-semibold text-default">Lời mời ({items?.length ?? 0})</h2>
      <p className="text-base text-muted">Mời một người trong họ: mở hồ sơ người đó trên cây và bấm “Mời người này”. Link chỉ hiện một lần lúc tạo.</p>
      {error && (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      )}
      {items === null ? (
        <p className="text-base text-muted">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="text-base text-muted">Chưa có lời mời nào.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((invite) => (
            <li key={invite.id} className="shadow-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border-default border bg-surface p-4">
              <div className="min-w-[14rem] flex-1">
                <p className="font-display break-words text-lg font-semibold text-default">{invite.member.name}</p>
                <p className="text-base text-muted">
                  {invite.status === 'used'
                    ? `Đã dùng ${when(invite.used_at)}${invite.used_by_email ? ` bởi ${invite.used_by_email}` : ''}`
                    : invite.status === 'pending'
                      ? `Dùng được đến ${when(invite.expires_at)}`
                      : invite.status === 'expired'
                        ? `Hết hạn ${when(invite.expires_at)}`
                        : 'Đã thu hồi'}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[invite.status]}`}>{inviteStatusLabel(invite.status)}</span>
              {invite.status === 'pending' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRevoking(invite)}
                  className="min-h-11 whitespace-nowrap rounded-lg px-3 text-base font-medium text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
                >
                  Thu hồi
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {revoking && (
        <ConfirmDialog
          title="Thu hồi lời mời?"
          message={`Link đã gửi cho ${revoking.member.name} sẽ không dùng được nữa.`}
          confirmLabel="Thu hồi"
          danger
          busy={busy}
          onConfirm={() => void revoke(revoking)}
          onCancel={() => setRevoking(null)}
        />
      )}
    </section>
  );
}
