'use client';

import { useEffect, useState } from 'react';
import {
  feedUrl,
  formatFullDate,
  REMINDER_CHOICES,
  reminderLabel,
  type ReminderSettings,
  type Subscription,
} from '@/lib/calendar/calendar';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const card = 'rounded-xl border-default border bg-surface p-4';

/** Solar <-> lunar converter ("Đổi ngày"). */
export function ConverterCard() {
  const [solar, setSolar] = useState('');
  const [lunar, setLunar] = useState({ day: '', month: '', year: String(new Date().getFullYear()), leap: false });
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function convert(query: URLSearchParams) {
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/calendar/convert?${query}`, { credentials: 'include' });
      if (response.status === 404) return setError('Ngày âm lịch này không tồn tại (tháng nhuận không có năm đó?).');
      if (!response.ok) return setError('Ngày chưa hợp lệ.');
      const body = (await response.json()) as { solar: string; lunar: { day: number; month: number; year: number; leap: boolean } };
      setResult(
        `${formatFullDate(body.solar)} dương lịch = ${body.lunar.day}/${body.lunar.month}${body.lunar.leap ? ' (nhuận)' : ''}/${body.lunar.year} âm lịch`,
      );
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    }
  }

  return (
    <section className={card} aria-label="Đổi ngày âm dương">
      <h2 className="text-sm font-semibold text-default">Đổi ngày âm ↔ dương</h2>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="text-xs text-muted">Dương lịch</span>
          <input type="date" value={solar} onChange={(e) => setSolar(e.target.value)} aria-label="Ngày dương lịch" className={field} />
        </label>
        <button type="button" className={primary} disabled={!solar} onClick={() => void convert(new URLSearchParams({ solar }))}>
          Đổi sang âm
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block w-20 text-sm">
          <span className="text-xs text-muted">Ngày âm</span>
          <input inputMode="numeric" value={lunar.day} onChange={(e) => setLunar({ ...lunar, day: e.target.value })} aria-label="Ngày âm" className={field} />
        </label>
        <label className="block w-20 text-sm">
          <span className="text-xs text-muted">Tháng</span>
          <input inputMode="numeric" value={lunar.month} onChange={(e) => setLunar({ ...lunar, month: e.target.value })} aria-label="Tháng âm" className={field} />
        </label>
        <label className="block w-24 text-sm">
          <span className="text-xs text-muted">Năm</span>
          <input inputMode="numeric" value={lunar.year} onChange={(e) => setLunar({ ...lunar, year: e.target.value })} aria-label="Năm âm" className={field} />
        </label>
        <label className="flex min-h-11 items-center gap-x-2 text-sm text-default">
          <input type="checkbox" checked={lunar.leap} onChange={(e) => setLunar({ ...lunar, leap: e.target.checked })} />
          Tháng nhuận
        </label>
        <button
          type="button"
          className={primary}
          disabled={!lunar.day || !lunar.month || !lunar.year}
          onClick={() =>
            void convert(
              new URLSearchParams({ lunar_day: lunar.day, lunar_month: lunar.month, lunar_year: lunar.year, lunar_leap: String(lunar.leap) }),
            )
          }
        >
          Đổi sang dương
        </button>
      </div>
      {result && (
        <p role="status" className="mt-3 text-sm font-medium text-default">
          {result}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

/** The secret link for a phone calendar. Everyone signed in can copy it; admins create, replace or remove it. */
export function SubscribeCard({ isAdmin }: { isAdmin: boolean }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/calendar/subscription', { credentials: 'include' })
      .then((response) => (response.ok ? (response.json() as Promise<Subscription>) : null))
      .then(setSubscription)
      .catch(() => undefined);
  }, []);

  async function change(method: 'POST' | 'DELETE') {
    if (method === 'POST' && subscription?.enabled && !window.confirm('Tạo link mới? Link cũ trên các điện thoại sẽ ngừng cập nhật.')) return;
    setMessage(null);
    const response = await fetch('/api/calendar/subscription', { method, credentials: 'include' });
    if (!response.ok) return setMessage('Không thể thực hiện. Vui lòng thử lại.');
    setSubscription(method === 'DELETE' ? { enabled: false, path: null } : ((await response.json()) as Subscription));
    setCopied(false);
  }

  if (!subscription) return null;
  const url = subscription.path ? feedUrl(window.location.origin, subscription.path) : null;
  return (
    <section className={card} aria-label="Thêm vào lịch điện thoại">
      <h2 className="text-sm font-semibold text-default">Thêm vào lịch điện thoại</h2>
      {url ? (
        <>
          <p className="mt-1 text-xs leading-5 text-muted">
            Dán link này vào Google Calendar / Apple Calendar (“Đăng ký lịch qua URL”). Giỗ và sự kiện sẽ tự cập nhật. Đây là link bí mật: ai có
            link đều xem được lịch giỗ của họ.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input readOnly value={url} aria-label="Link lịch" onFocus={(e) => e.currentTarget.select()} className={`${field} mt-0 flex-1 font-mono text-xs`} />
            <button
              type="button"
              className={primary}
              onClick={() => {
                void navigator.clipboard?.writeText(url).then(() => setCopied(true));
              }}
            >
              {copied ? 'Đã chép' : 'Chép link'}
            </button>
          </div>
          {isAdmin && (
            <div className="mt-1 flex flex-wrap">
              <button type="button" className={ghost} onClick={() => void change('POST')}>
                Tạo link mới
              </button>
              <button type="button" className={danger} onClick={() => void change('DELETE')}>
                Tắt link
              </button>
            </div>
          )}
        </>
      ) : isAdmin ? (
        <>
          <p className="mt-1 text-xs leading-5 text-muted">Chưa bật. Khi bật, cả họ có một link để thêm lịch giỗ vào điện thoại.</p>
          <button type="button" className={`${primary} mt-2`} onClick={() => void change('POST')}>
            Bật link lịch
          </button>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted">Quản trị viên chưa bật link lịch cho dòng họ.</p>
      )}
      {message && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {message}
        </p>
      )}
    </section>
  );
}

/** How many days before a giỗ/event I want to hear about it, and whether by email too. */
export function ReminderCard() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/calendar/reminders', { credentials: 'include' })
      .then((response) => (response.ok ? (response.json() as Promise<ReminderSettings>) : null))
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  async function save(next: ReminderSettings) {
    setSettings(next);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch('/api/calendar/reminders', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!response.ok) return setError('Không lưu được. Vui lòng thử lại.');
      setSettings((await response.json()) as ReminderSettings);
      setSaved(true);
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    }
  }

  if (!settings) return null;
  return (
    <section className={card} aria-label="Nhắc việc">
      <h2 className="text-sm font-semibold text-default">Nhắc tôi trước giỗ và sự kiện</h2>
      <div className="mt-2 flex flex-wrap gap-x-4">
        {REMINDER_CHOICES.map((days) => (
          <label key={days} className="flex min-h-11 items-center gap-x-2 text-sm text-default">
            <input
              type="checkbox"
              checked={settings.days.includes(days)}
              onChange={(e) => void save({ ...settings, days: e.target.checked ? [...settings.days, days] : settings.days.filter((d) => d !== days) })}
            />
            {reminderLabel(days)}
          </label>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-x-2 text-sm text-default">
        <input type="checkbox" checked={settings.email} onChange={(e) => void save({ ...settings, email: e.target.checked })} />
        Gửi cả email (khi hệ thống đã cấu hình gửi mail)
      </label>
      <p className="text-xs text-muted">Thông báo hiện ở chuông trên thanh đầu trang. Bỏ chọn hết để không nhận nhắc.</p>
      {saved && (
        <p role="status" className="mt-1 text-xs text-muted">
          Đã lưu.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
