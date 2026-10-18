'use client';

import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '@/components/common/useDialogFocus';
import { normaliseLinkInput } from '@/lib/chronicles/linkInput';

const field =
  'mt-1 h-11 w-full rounded-lg border-default border bg-app px-3 text-base text-default focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]';

/** "Chèn link": the address, and the words to show when nothing was selected. */
export function LinkDialog({
  initialHref,
  initialText,
  textEditable,
  onApply,
  onRemove,
  onCancel,
}: {
  initialHref: string;
  initialText: string;
  /** No selection: the person types the words too. */
  textEditable: boolean;
  onApply: (href: string, text: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
}) {
  const [href, setHref] = useState(initialHref);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  useDialogFocus(box, first);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // not a <form>: the editor sits inside the article's own form, and forms cannot nest
  function apply() {
    const clean = normaliseLinkInput(href);
    if (!clean) {
      setError('Địa chỉ chưa đúng. Ví dụ: https://example.com hoặc a@example.com');
      return;
    }
    if (textEditable && !text.trim()) {
      setError('Hãy nhập chữ sẽ hiện ra cho link.');
      return;
    }
    onApply(clean, text.trim());
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label="Chèn link"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
            event.preventDefault();
            apply();
          }
        }}
        className="shadow-float w-full max-w-md rounded-t-2xl border-default border bg-surface p-5 sm:rounded-2xl"
      >
        <h2 className="font-display text-lg font-bold text-default">Chèn link</h2>
        <label className="mt-3 block">
          <span className="text-base text-default">Địa chỉ link</span>
          <input ref={first} value={href} onChange={(event) => setHref(event.target.value)} inputMode="url" autoComplete="off" placeholder="https://…" className={field} />
        </label>
        {textEditable && (
          <label className="mt-3 block">
            <span className="text-base text-default">Chữ hiện ra</span>
            <input value={text} onChange={(event) => setText(event.target.value)} className={field} />
          </label>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {onRemove && (
            <button type="button" onClick={onRemove} className="me-auto min-h-11 rounded-lg px-3 text-base text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
              Bỏ link
            </button>
          )}
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border-default border px-4 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
            Huỷ
          </button>
          <button type="button" onClick={apply} className="min-h-11 rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
