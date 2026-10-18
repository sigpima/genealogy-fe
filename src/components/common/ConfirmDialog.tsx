'use client';

import { useEffect, useRef } from 'react';
import { useDialogFocus } from '@/components/common/useDialogFocus';

/** "Are you sure?" before something that cannot be undone with one tap. Esc and the backdrop cancel; focus starts on the safe button. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(boxRef, cancelRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="shadow-float w-full max-w-md rounded-t-2xl border-default border bg-surface p-5 sm:rounded-2xl"
      >
        <h2 className="font-display text-lg font-bold text-default">{title}</h2>
        <p className="mt-2 text-base text-default">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg border-default border px-4 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-11 rounded-lg px-4 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50 ${
              danger ? 'bg-[var(--color-danger)] text-white hover:opacity-90' : 'bg-primary text-on-primary hover:opacity-90'
            }`}
          >
            {busy ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
