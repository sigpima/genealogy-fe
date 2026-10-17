'use client';

import { useEffect, useState } from 'react';
import {
  changedLevels,
  FIELDS,
  LEVELS,
  publicNeedsPublicTree,
  type PrivacyFields,
  type PrivacyLevel,
} from '@/lib/privacy/privacy';

/** "Quyền riêng tư": who may see each sensitive field (admins always see everything). */
export function PrivacyPanel() {
  const [saved, setSaved] = useState<PrivacyFields | null>(null);
  const [fields, setFields] = useState<PrivacyFields | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'public' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/privacy', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ fields: PrivacyFields }>) : Promise.reject()))
      .then((body) => {
        setSaved(body.fields);
        setFields(body.fields);
      })
      .catch(() => setMessage({ kind: 'error', text: 'Không thể tải cài đặt quyền riêng tư.' }));
    fetch('/api/admin/settings', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setVisibility(s?.visibility ?? null))
      .catch(() => undefined);
  }, []);

  async function save() {
    if (!saved || !fields) return;
    const changes = changedLevels(saved, fields);
    if (Object.keys(changes).length === 0) return setMessage({ kind: 'ok', text: 'Không có thay đổi nào.' });
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/privacy', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!response.ok) return setMessage({ kind: 'error', text: 'Không thể lưu. Vui lòng thử lại.' });
      const body = (await response.json()) as { fields: PrivacyFields };
      setSaved(body.fields);
      setFields(body.fields);
      setMessage({ kind: 'ok', text: 'Đã lưu quyền riêng tư.' });
    } catch {
      setMessage({ kind: 'error', text: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setBusy(false);
    }
  }

  if (!fields) {
    return message ? <p role="alert" className="text-sm text-danger">{message.text}</p> : <p className="text-sm text-muted">Đang tải...</p>;
  }
  const warning = publicNeedsPublicTree(fields, visibility);

  return (
    <section aria-label="Quyền riêng tư theo trường" className="space-y-4">
      <p className="text-sm text-muted">
        Chọn ai được xem từng thông tin trong hồ sơ. Quản trị viên luôn xem được tất cả; tên, giới tính, năm sinh/mất và hình dạng cây không nằm trong danh sách này.
      </p>
      <ul className="divide-y divide-[var(--color-border)] rounded-xl border-default border bg-surface">
        {FIELDS.map((field) => (
          <li key={field.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <label htmlFor={`privacy-${field.key}`} className="min-w-0 flex-1 text-sm">
              <span className="block font-medium text-default">{field.label}</span>
              {field.hint && <span className="block text-xs text-muted">{field.hint}</span>}
            </label>
            <select
              id={`privacy-${field.key}`}
              aria-label={`Mức xem: ${field.label}`}
              value={fields[field.key]}
              onChange={(e) => setFields({ ...fields, [field.key]: e.target.value as PrivacyLevel })}
              className="min-h-11 rounded-lg border-default border bg-app px-2 text-sm text-default"
            >
              {LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {warning && <p role="note" className="text-xs text-muted">{warning}</p>}
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-danger' : 'text-default'}`}>
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
      >
        {busy ? 'Đang lưu...' : 'Lưu quyền riêng tư'}
      </button>
    </section>
  );
}
