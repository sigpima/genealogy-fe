'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConverterCard, ReminderCard, SubscribeCard } from './CalendarTools';
import { EventDialog } from './EventDialog';
import { CardsDialog } from '@/components/invitations/CardsDialog';
import {
  EVENT_KIND_LABELS,
  formatDayMonth,
  formatFullDate,
  lunarLabel,
  monthGrid,
  monthTitle,
  parseDayParam,
  relativeDays,
  shiftMonth,
  WEEKDAYS,
  type CalendarItem,
  type FamilyEvent,
  type MonthView,
} from '@/lib/calendar/calendar';
import { focusHref } from '@/lib/search/search';

const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Month calendar with the lunar date under every day, the giỗ and events, an upcoming list and the tools around it. */
export function CalendarView({ isAdmin, signedIn, onUnauthorized }: { isAdmin: boolean; signedIn: boolean; onUnauthorized: () => void }) {
  const today = useMemo(localToday, []);
  const [view, setView] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const [selected, setSelected] = useState(today);
  const [data, setData] = useState<MonthView | null>(null);
  const [upcoming, setUpcoming] = useState<CalendarItem[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ event?: FamilyEvent; date?: string } | null>(null);
  const [cards, setCards] = useState<{ event: FamilyEvent; date: string } | null>(null);
  const [reload, setReload] = useState(0);

  // /lich?ngay=2024-09-17 (a notification's link) opens that month with the day selected.
  useEffect(() => {
    const wanted = parseDayParam(window.location.search);
    if (wanted) {
      setView({ year: wanted.year, month: wanted.month });
      setSelected(wanted.date);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/calendar/month?year=${view.year}&month=${view.month}`, { credentials: 'include' });
        if (response.status === 401) return onUnauthorized();
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as MonthView;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Không tải được lịch. Vui lòng thử lại.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, reload, onUnauthorized]);

  useEffect(() => {
    fetch('/api/calendar/upcoming?days=60', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ items: CalendarItem[] }>) : { items: [] }))
      .then((b) => setUpcoming(b.items))
      .catch(() => undefined);
    if (isAdmin) {
      fetch('/api/events', { credentials: 'include' })
        .then((r) => (r.ok ? (r.json() as Promise<FamilyEvent[]>) : []))
        .then(setEvents)
        .catch(() => undefined);
    }
  }, [isAdmin, reload]);

  const grid = useMemo(() => (data ? monthGrid(data.days, data.items) : []), [data]);
  const dayItems = useMemo(() => (data?.items ?? []).filter((i) => i.date === selected), [data, selected]);
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const refresh = useCallback(async () => {
    setDialog(null);
    setReload((n) => n + 1);
  }, []);

  async function removeEvent(event: FamilyEvent) {
    if (!window.confirm(`Xoá sự kiện “${event.title}”?`)) return;
    const response = await fetch(`/api/events/${event.id}`, { method: 'DELETE', credentials: 'include' });
    if (response.ok) await refresh();
    else setError('Không xoá được sự kiện. Vui lòng thử lại.');
  }

  function go(delta: number) {
    setView((v) => shiftMonth(v.year, v.month, delta));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-default">Lịch giỗ &amp; sự kiện</h1>
          <p className="mt-1 text-sm text-muted">Luôn hiện cả ngày dương và ngày âm. Giỗ tự tính từ ngày mất âm lịch của từng người.</p>
        </div>
        {isAdmin && (
          <button type="button" className={primary} onClick={() => setDialog({ date: selected })}>
            Thêm sự kiện
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Lịch tháng">
          <div className="flex items-center justify-between">
            <button type="button" className={ghost} onClick={() => go(-1)} aria-label="Tháng trước">
              ←
            </button>
            <h2 className="font-display text-lg font-bold text-default" aria-live="polite">
              {monthTitle(view.year, view.month)}
            </h2>
            <div className="flex">
              <button
                type="button"
                className={ghost}
                onClick={() => {
                  setView({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
                  setSelected(today);
                }}
              >
                Hôm nay
              </button>
              <button type="button" className={ghost} onClick={() => go(1)} aria-label="Tháng sau">
                →
              </button>
            </div>
          </div>
          <div role="grid" aria-label={monthTitle(view.year, view.month)} className="mt-2 overflow-hidden rounded-xl border-default border bg-surface">
            <div role="row" className="grid grid-cols-7 bg-surface-muted text-center text-xs font-semibold text-muted">
              {WEEKDAYS.map((w) => (
                <div key={w} role="columnheader" className="py-2">
                  {w}
                </div>
              ))}
            </div>
            {grid.map((week, wi) => (
              <div key={wi} role="row" className="grid grid-cols-7 border-default border-t">
                {week.map((cell, ci) =>
                  cell.day ? (
                    <button
                      key={ci}
                      type="button"
                      role="gridcell"
                      aria-selected={cell.day.date === selected}
                      aria-label={`${formatFullDate(cell.day.date)}, âm lịch ${lunarLabel(cell.day)}${cell.items.length ? `, ${cell.items.length} mục` : ''}`}
                      onClick={() => setSelected(cell.day!.date)}
                      className={`min-h-16 border-default border-e p-1 text-left align-top last:border-e-0 hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                        cell.day.date === selected ? 'bg-surface-muted ring-2 ring-inset ring-[var(--color-primary)]' : ''
                      }`}
                    >
                      <span className="flex items-baseline justify-between">
                        <span className={`text-sm font-semibold ${cell.day.date === today ? 'rounded-full bg-primary px-1.5 text-on-primary' : 'text-default'}`}>
                          {Number(cell.day.date.slice(8))}
                        </span>
                        <span className={`text-[11px] ${cell.day.lunar_day === 1 ? 'font-semibold text-primary' : 'text-muted'}`}>{lunarLabel(cell.day)}</span>
                      </span>
                      <span className="mt-0.5 block space-y-0.5">
                        {cell.items.slice(0, 2).map((item, i) => (
                          <span
                            key={i}
                            className={`block truncate rounded px-1 text-[10px] leading-4 ${
                              item.kind === 'death_anniversary' ? 'bg-primary text-on-primary' : 'bg-surface-muted text-primary'
                            }`}
                          >
                            {item.title}
                          </span>
                        ))}
                        {cell.items.length > 2 && <span className="block text-[10px] text-muted">+{cell.items.length - 2}</span>}
                      </span>
                    </button>
                  ) : (
                    <div key={ci} className="border-default border-e bg-app/50 last:border-e-0" />
                  ),
                )}
              </div>
            ))}
          </div>
          {data && data.incomplete > 0 && (
            <p className="mt-2 text-xs text-muted">
              {data.incomplete} người có ngày mất theo dương lịch nhưng thiếu năm nên chưa tính được giỗ — bổ sung năm hoặc nhập ngày âm lịch.
            </p>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border-default border bg-surface p-4" aria-label="Chi tiết ngày">
            <h2 className="text-sm font-semibold text-default">
              {formatFullDate(selected)}
              {data?.days.find((d) => d.date === selected) && (
                <span className="ms-2 font-normal text-muted">
                  · {data.days.find((d) => d.date === selected)!.lunar_day}/{data.days.find((d) => d.date === selected)!.lunar_month} âm lịch
                </span>
              )}
            </h2>
            {dayItems.length === 0 && <p className="mt-2 text-sm text-muted">Không có giỗ hay sự kiện.</p>}
            <ul className="mt-2 space-y-3">
              {dayItems.map((item, i) => (
                <li key={i} className="text-sm text-default">
                  <p className="font-medium">
                    {item.kind === 'death_anniversary' && item.member_id !== null ? (
                      <Link href={focusHref(item.member_id)} className="text-primary underline">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {[item.subtitle, item.event_kind ? EVENT_KIND_LABELS[item.event_kind] : null, item.time_text && `lúc ${item.time_text}`, item.place_id ? null : item.location]
                      .filter(Boolean)
                      .join(' · ')}
                    {item.place_id ? (
                      <>
                        {' · '}
                        <Link href={`/dia-diem?place=${item.place_id}`} className="text-primary underline">
                          {item.location}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {item.description && <p className="mt-1 whitespace-pre-wrap text-xs text-default">{item.description}</p>}
                  {isAdmin && item.event_id !== null && eventById.get(item.event_id) && (
                    <div className="flex">
                      <button type="button" className={ghost} onClick={() => setCards({ event: eventById.get(item.event_id!)!, date: item.date })}>
                        Thiệp mời
                      </button>
                      <button type="button" className={ghost} onClick={() => setDialog({ event: eventById.get(item.event_id!) })}>
                        Sửa
                      </button>
                      <button type="button" className={danger} onClick={() => void removeEvent(eventById.get(item.event_id!)!)}>
                        Xoá
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border-default border bg-surface p-4" aria-label="Sắp tới">
            <h2 className="text-sm font-semibold text-default">Sắp tới (60 ngày)</h2>
            {upcoming.length === 0 && <p className="mt-2 text-sm text-muted">Không có giỗ hay sự kiện nào sắp tới.</p>}
            <ul className="mt-2 space-y-1.5">
              {upcoming.slice(0, 12).map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(item.date);
                      setView({ year: Number(item.date.slice(0, 4)), month: Number(item.date.slice(5, 7)) });
                    }}
                    className="flex min-h-11 w-full items-baseline justify-between gap-x-2 rounded-lg px-2 text-left text-sm text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    <span className="min-w-0 truncate">
                      <b className="font-semibold">{formatDayMonth(item.date)}</b> {item.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{relativeDays(item.date, today)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ConverterCard />
        {signedIn && <SubscribeCard isAdmin={isAdmin} />}
        {signedIn && <ReminderCard />}
      </div>

      {cards && <CardsDialog eventId={cards.event.id} eventTitle={cards.event.title} date={cards.date} onClose={() => setCards(null)} />}
      {dialog && <EventDialog event={dialog.event} initialDate={dialog.date} onClose={() => setDialog(null)} onSaved={refresh} />}
    </div>
  );
}
