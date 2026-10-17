'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EMPTY_EVENT_FORM,
  EVENT_KIND_LABELS,
  eventPayload,
  eventToForm,
  type EventForm,
  type EventKind,
  type FamilyEvent,
} from '@/lib/calendar/calendar';
import type { Place } from '@/lib/places/places';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

/** Create or edit a family event (admins). A lunar event keeps its lunar date every year, so its solar day moves. */
export function EventDialog({
  event,
  initialDate,
  onClose,
  onSaved,
}: {
  event?: FamilyEvent;
  /** Pre-fill a solar date, e.g. the day selected on the calendar (YYYY-MM-DD). */
  initialDate?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<EventForm>(() => {
    if (event) return eventToForm(event);
    if (initialDate) {
      const [y, m, d] = initialDate.split('-').map(Number);
      return { ...EMPTY_EVENT_FORM, calendar: 'solar', year: String(y), month: String(m), day: String(d), repeats_yearly: false };
    }
    return EMPTY_EVENT_FORM;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    fetch('/api/places', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<Place[]>) : []))
      .then(setPlaces)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = eventPayload(form);
    if (!result.ok) return setError(result.error);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(event ? `/api/events/${event.id}` : '/api/events', {
        method: event ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.payload),
      });
      if (!response.ok) {
        setError(response.status === 422 ? 'Thông tin chưa hợp lệ, hãy kiểm tra lại ngày tháng.' : 'Không thể lưu. Vui lòng thử lại.');
        return;
      }
      await onSaved();
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <form
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="shadow-float max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl border-default border bg-surface p-5 outline-none sm:rounded-2xl"
      >
        <h2 id="event-title" className="font-display text-lg font-bold text-default">
          {event ? 'Sửa sự kiện' : 'Thêm sự kiện'}
        </h2>
        <label className="block text-sm">
          <span className="text-xs text-muted">Tên sự kiện</span>
          <input required value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={150} aria-label="Tên sự kiện" className={field} placeholder="Giỗ Tổ họ" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs text-muted">Loại</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value as EventKind)} aria-label="Loại sự kiện" className={field}>
              {(Object.keys(EVENT_KIND_LABELS) as EventKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {EVENT_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted">Tính theo</span>
            <select value={form.calendar} onChange={(e) => set('calendar', e.target.value as EventForm['calendar'])} aria-label="Lịch" className={field}>
              <option value="lunar">Âm lịch</option>
              <option value="solar">Dương lịch</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted">Ngày</span>
            <input inputMode="numeric" value={form.day} onChange={(e) => set('day', e.target.value)} aria-label="Ngày" className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted">Tháng</span>
            <input inputMode="numeric" value={form.month} onChange={(e) => set('month', e.target.value)} aria-label="Tháng" className={field} />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-x-2 text-sm text-default">
          <input type="checkbox" checked={form.repeats_yearly} onChange={(e) => set('repeats_yearly', e.target.checked)} />
          Lặp lại hằng năm ({form.calendar === 'lunar' ? 'theo âm lịch' : 'theo dương lịch'})
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">{form.repeats_yearly ? 'Từ năm (tuỳ chọn)' : 'Năm'}</span>
          <input inputMode="numeric" value={form.year} onChange={(e) => set('year', e.target.value)} aria-label="Năm" className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-xs text-muted">Giờ (vd 08:30)</span>
            <input value={form.time_text} onChange={(e) => set('time_text', e.target.value)} aria-label="Giờ" className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted">Địa điểm (ghi chú)</span>
            <input value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={255} aria-label="Địa điểm" className={field} />
          </label>
        </div>
        {places.length > 0 && (
          <label className="block text-sm">
            <span className="text-xs text-muted">Hoặc chọn một địa điểm của họ</span>
            <select value={form.place_id} onChange={(e) => set('place_id', e.target.value)} aria-label="Chọn địa điểm" className={field}>
              <option value="">Không chọn</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="text-xs text-muted">Ghi chú</span>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} aria-label="Ghi chú sự kiện" className={`${field} py-2`} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-x-2">
          <button type="button" className={ghost} onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className={primary} disabled={busy}>
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}
