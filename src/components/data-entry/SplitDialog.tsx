'use client';

import { useEffect, useRef, useState } from 'react';
import { parseSplitNames, splitError, suggestSplitNames } from '@/lib/data-entry/split';

export type SplitDialogProps = {
  memberName: string;
  onCancel: () => void;
  /** Resolve to an error text, or null when done. */
  onSubmit: (names: string[]) => Promise<string | null>;
};

/** "Tách N vị": replace one entry such as "Nguyễn Vô Danh 3 Vị" by separate siblings, one name per line. */
export function SplitDialog({ memberName, onCancel, onSubmit }: SplitDialogProps) {
  const [text, setText] = useState(() => suggestSplitNames(memberName));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const names = parseSplitNames(text);

  async function submit() {
    const problem = splitError(names);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(await onSubmit(names));
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-title"
        className="shadow-float w-full max-w-md rounded-2xl border-default border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="split-title" className="font-display text-lg font-bold text-default">
          Tách “{memberName}”
        </h2>
        <p className="mt-1 text-sm text-muted">
          Thay một dòng gộp bằng nhiều anh chị em cùng cha. Dòng đầu đổi tên người hiện tại, các dòng sau là người mới.
        </p>
        <label className="mt-4 block text-sm">
          <span className="text-xs text-muted">Mỗi tên một dòng ({names.length} tên)</span>
          <textarea
            ref={areaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            rows={6}
            className="mt-1 w-full rounded-lg border-default border bg-app px-3 py-2 text-sm text-default focus:border-[var(--color-primary)] focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg px-4 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
          >
            Tách {names.length || ''} người
          </button>
        </div>
      </div>
    </div>
  );
}
