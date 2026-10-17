'use client';

import { useState } from 'react';
import { cellText, parseCell, type CellKind } from '@/lib/data-entry/cells';

const inputClass =
  'w-full min-w-0 rounded border border-transparent bg-transparent px-2 py-1.5 text-sm text-default hover:border-default focus:border-[var(--color-primary)] focus:bg-app focus:outline-none';

export type EditableCellProps = {
  value: string | number | null;
  kind: Exclude<CellKind, 'gender'>;
  /** Accessible name, e.g. "Năm sinh của Nguyễn Văn A". */
  label: string;
  /** Persist the parsed value; resolve to an error text, or null when saved. */
  onSave: (value: string | number | null) => Promise<string | null>;
  inputMode?: 'numeric' | 'text';
};

/** A text-like grid cell: saves on blur/Enter only when the text changed, Esc reverts, errors stay visible. */
export function EditableCell({ value, kind, label, onSave, inputMode }: EditableCellProps) {
  const [text, setText] = useState(cellText(value));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Follow the stored value when it changes from elsewhere (a reload, another edit) but never while typing.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(cellText(value));
  }

  async function commit() {
    if (text.trim() === cellText(value).trim()) {
      setError(null);
      return;
    }
    const parsed = parseCell(kind, text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    const failure = await onSave(parsed.value);
    setSaving(false);
    setError(failure);
  }

  return (
    <div>
      <input
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode={inputMode}
        value={text}
        disabled={saving}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setText(cellText(value));
            setError(null);
          }
        }}
        className={`${inputClass} ${error ? '!border-[var(--color-danger)]' : ''}`}
      />
      {error && (
        <p role="alert" className="px-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
