'use client';

import { useEffect, useState } from 'react';
import type { SiteInfo } from '@/lib/auth/session';

const VISIBILITY: {
  value: SiteInfo['visibility'];
  title: string;
  hint: string;
}[] = [
  {
    value: 'private',
    title: 'Riêng tư',
    hint: 'Phải đăng nhập mới xem được gia phả.',
  },
  {
    value: 'public',
    title: 'Công khai (chỉ xem)',
    hint: 'Ai cũng xem được cây mà không cần đăng nhập. Khách không thấy tiểu sử, nơi ở và mộ phần.',
  },
];

export function SettingsPanel() {
  const [settings, setSettings] = useState<SiteInfo | null>(null);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then((response) =>
        response.ok ? (response.json() as Promise<SiteInfo>) : Promise.reject(),
      )
      .then(setSettings)
      .catch(() =>
        setMessage({ kind: 'error', text: 'Không thể tải cài đặt.' }),
      );
  }, []);

  async function save() {
    if (!settings) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setMessage(
        response.ok
          ? { kind: 'ok', text: 'Đã lưu cài đặt.' }
          : { kind: 'error', text: 'Không thể lưu. Vui lòng thử lại.' },
      );
    } catch {
      setMessage({ kind: 'error', text: 'Không thể kết nối tới máy chủ.' });
    } finally {
      setIsSaving(false);
    }
  }

  if (!settings) {
    return message ? (
      <p role="alert" className="text-sm text-danger">
        {message.text}
      </p>
    ) : (
      <p className="text-sm text-muted">Đang tải...</p>
    );
  }

  return (
    <div className="space-y-8">
      <Choice
        legend="Ai xem được gia phả?"
        name="visibility"
        options={VISIBILITY}
        value={settings.visibility}
        onChange={(value) => setSettings({ ...settings, visibility: value })}
      />
      <div>
        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`mb-3 text-sm ${message.kind === 'error' ? 'text-danger' : 'text-default'}`}
          >
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
        >
          {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; title: string; hint: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {legend}
      </legend>
      <div className="mt-3 space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer items-start gap-x-3 rounded-xl border p-3 ${
              value === option.value
                ? 'border-[var(--color-primary)] bg-surface-muted'
                : 'border-default bg-surface'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 accent-[var(--color-primary)]"
            />
            <span>
              <span className="block text-sm font-medium text-default">
                {option.title}
              </span>
              <span className="block text-sm text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
