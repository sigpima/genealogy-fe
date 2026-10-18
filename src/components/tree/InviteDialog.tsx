'use client';

import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '@/components/common/useDialogFocus';
import { createInvitation, inviteUrl, type InviteCreated } from '@/lib/invites/invites';

/** "Mời người này": makes the link on open and shows it ONCE (only its hash is kept); a new link cancels the one before. */
export function InviteDialog({ memberId, memberName, onClose }: { memberId: number; memberName: string; onClose: () => void }) {
  const [state, setState] = useState<{ kind: 'making' } | { kind: 'done'; invite: InviteCreated } | { kind: 'error'; message: string }>({ kind: 'making' });
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useDialogFocus(box, close);

  // Exactly one request per opening: making a link cancels the previous one, so a second call (React's development
  // double-run of effects, a double click) would kill the link being shown.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void createInvitation(memberId).then((result) => {
      setState(result.ok ? { kind: 'done', invite: result.invite } : { kind: 'error', message: result.error });
    });
  }, [memberId]);

  useEffect(() => {
    if (state.kind === 'done') field.current?.select();
  }, [state]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const link = state.kind === 'done' ? inviteUrl(state.invite.path, window.location.origin) : '';

  async function copy() {
    field.current?.select();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false); // plain http or no permission: the link stays selected, press Ctrl+C
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label="Mời người này"
        onClick={(event) => event.stopPropagation()}
        className="shadow-float w-full max-w-md rounded-t-2xl border-default border bg-surface p-5 sm:rounded-2xl"
      >
        <h2 className="font-display text-lg font-bold text-default">Mời {memberName}</h2>
        {state.kind === 'making' && <p className="mt-3 text-base text-muted">Đang tạo link mời…</p>}
        {state.kind === 'error' && (
          <p role="alert" className="mt-3 text-base text-danger">
            {state.message}
          </p>
        )}
        {state.kind === 'done' && (
          <>
            <p className="mt-3 text-base text-default">Gửi link này cho {memberName}. Người nhận mở link, đặt email và mật khẩu là vào được cây, đúng vị trí của mình.</p>
            <label className="mt-3 block text-base text-default">
              Link mời
              <input
                ref={field}
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-1 h-11 w-full rounded-lg border-default border bg-app px-3 text-base text-default"
              />
            </label>
            <button
              type="button"
              onClick={() => void copy()}
              className="mt-3 min-h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] sm:w-auto"
            >
              {copied ? 'Đã sao chép' : 'Sao chép link'}
            </button>
            <p role="status" className="mt-2 text-sm text-muted">
              {copied ? 'Đã chép vào bộ nhớ tạm.' : 'Nếu nút không chép được, link đã được chọn sẵn: bấm Ctrl+C (hoặc giữ ngón tay rồi chọn Sao chép).'}
            </p>
            <p className="mt-2 text-sm text-default">
              Link chỉ hiện <strong>một lần</strong> và dùng được 14 ngày. Tạo link mới thì link cũ hết tác dụng. Xem và thu hồi ở Quản trị → Người dùng.
            </p>
          </>
        )}
        <div className="mt-4 flex justify-end">
          <button ref={close} type="button" onClick={onClose} className="min-h-11 rounded-lg border-default border px-4 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
