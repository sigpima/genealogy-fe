'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  countsLine,
  fullLink,
  longDate,
  parseNames,
  RESPONSE_LABELS,
  type Card,
  type CardDetail,
  type Rsvp,
} from '@/lib/invitations/invitations';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

/** Admin tool next to an event: the invitation cards for it, their links and who has answered. */
export function CardsDialog({ eventId, eventTitle, date, onClose }: { eventId: number; eventTitle: string; date: string; onClose: () => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState(date);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/events/${eventId}/cards`, { credentials: 'include' });
    if (response.ok) setCards((await response.json()) as Card[]);
  }, [eventId]);

  useEffect(() => {
    void load();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [load, onClose]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const response = await fetch(`/api/events/${eventId}/cards`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: when, message: message.trim() || null }),
    });
    if (!response.ok) {
      return setError(response.status === 422 ? 'Ngày này không phải một ngày diễn ra của sự kiện.' : 'Không tạo được thiệp. Vui lòng thử lại.');
    }
    const card = (await response.json()) as Card;
    setMessage('');
    await load();
    setOpen(card.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Thiệp mời ${eventTitle}`} onClick={(e) => e.stopPropagation()} className="shadow-float flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border-default border bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-default border-b px-5 py-3">
          <h2 className="font-display text-lg font-bold text-default">Thiệp mời · {eventTitle}</h2>
          <button type="button" className={ghost} onClick={onClose}>
            Đóng ✕
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <form onSubmit={create} className="space-y-2 rounded-xl border-default border p-3" aria-label="Tạo thiệp mới">
            <p className="text-sm font-semibold text-default">Tạo thiệp cho một ngày diễn ra</p>
            <label className="block text-sm">
              <span className="text-xs text-muted">Ngày (dương lịch)</span>
              <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Ngày của thiệp" className={field} />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-muted">Lời mời (tuỳ chọn)</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} aria-label="Lời mời" className={`${field} py-2`} />
            </label>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button type="submit" className={primary}>
              Tạo thiệp
            </button>
          </form>
          {cards && cards.length === 0 && <p className="text-sm text-muted">Chưa có thiệp nào cho sự kiện này.</p>}
          <ul className="space-y-3">
            {(cards ?? []).map((card) => (
              <li key={card.id} className="rounded-xl border-default border p-3">
                <button type="button" onClick={() => setOpen(open === card.id ? null : card.id)} aria-expanded={open === card.id} className="w-full text-left">
                  <span className="block font-semibold text-default">{longDate(card.date)}</span>
                  <span className="block text-xs text-muted">{countsLine(card.counts)}</span>
                  {(card.closed || card.expired) && <span className="text-xs font-semibold text-danger">Đã đóng</span>}
                </button>
                {open === card.id && <CardPanel cardId={card.id} onChanged={load} onDeleted={async () => { setOpen(null); await load(); }} />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CardPanel({ cardId, onChanged, onDeleted }: { cardId: number; onChanged: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [names, setNames] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [created, setCreated] = useState<Rsvp[]>([]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/cards/${cardId}`, { credentials: 'include' });
    if (response.ok) setDetail((await response.json()) as CardDetail);
  }, [cardId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: object) {
    await fetch(`/api/cards/${cardId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await load();
    await onChanged();
  }

  async function copy(text: string) {
    await navigator.clipboard?.writeText(text);
    setCopied(text);
  }

  async function invite() {
    const list = parseNames(names);
    if (list.length === 0) return;
    const response = await fetch(`/api/cards/${cardId}/invitees`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: list }) });
    if (response.ok) {
      setCreated((await response.json()) as Rsvp[]);
      setNames('');
      await load();
      await onChanged();
    }
  }

  async function removeResponse(r: Rsvp) {
    if (!window.confirm(`Xoá câu trả lời của “${r.name}”?`)) return;
    await fetch(`/api/cards/${cardId}/responses/${r.id}`, { method: 'DELETE', credentials: 'include' });
    await load();
    await onChanged();
  }

  async function removeCard() {
    if (!window.confirm('Xoá thiệp này? Đường dẫn sẽ ngừng dùng được và các câu trả lời bị xoá.')) return;
    await fetch(`/api/cards/${cardId}`, { method: 'DELETE', credentials: 'include' });
    await onDeleted();
  }

  if (!detail) return <p className="mt-2 text-sm text-muted">Đang tải...</p>;
  const link = fullLink(window.location.origin, detail.path);
  return (
    <div className="mt-3 space-y-4 border-default border-t pt-3 text-sm text-default">
      <div>
        <p className="text-xs text-muted">Link chung — gửi vào nhóm Zalo / email:</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <input readOnly value={link} aria-label="Link thiệp chung" onFocus={(e) => e.currentTarget.select()} className={`${field} mt-0 flex-1 font-mono text-xs`} />
          <button type="button" className={primary} onClick={() => void copy(link)}>
            {copied === link ? 'Đã chép' : 'Chép link'}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap">
          <button type="button" className={ghost} onClick={() => void patch({ closed: !detail.closed })}>
            {detail.closed ? 'Mở lại nhận trả lời' : 'Đóng nhận trả lời'}
          </button>
          <a href={`/api/cards/${cardId}/export.csv`} className={`${ghost} flex items-center`} download>
            Tải danh sách (CSV)
          </a>
          <button type="button" className={danger} onClick={() => void removeCard()}>
            Xoá thiệp
          </button>
        </div>
        {detail.expired && <p className="text-xs text-danger">Đã quá hạn trả lời ({detail.closes_on}).</p>}
      </div>

      <div>
        <p className="font-semibold">Link riêng từng người</p>
        <textarea value={names} onChange={(e) => setNames(e.target.value)} rows={3} placeholder="Mỗi tên một dòng..." aria-label="Tên người được mời" className={`${field} py-2`} />
        <button type="button" className={primary} disabled={parseNames(names).length === 0} onClick={() => void invite()}>
          Tạo link riêng
        </button>
        {created.length > 0 && (
          <ul className="mt-2 space-y-1" aria-label="Link riêng vừa tạo">
            {created.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-2 text-xs">
                <b>{r.name}</b>
                <button type="button" className={ghost} onClick={() => void copy(fullLink(window.location.origin, r.path))}>
                  {copied === fullLink(window.location.origin, r.path) ? 'Đã chép' : 'Chép link'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="font-semibold">Câu trả lời ({detail.responses.length})</p>
        {detail.responses.length === 0 && <p className="text-xs text-muted">Chưa có ai trả lời.</p>}
        <ul className="mt-1 divide-y divide-[var(--color-border)]">
          {detail.responses.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-2 py-1.5">
              <span className="min-w-0">
                <b>{r.name}</b>{' '}
                <span className="text-muted">
                  {r.response ? `${RESPONSE_LABELS[r.response]}${r.response === 'yes' ? ` · ${r.party_size} người` : ''}` : 'chưa trả lời'}
                </span>
                {r.note && <span className="block text-xs text-muted">“{r.note}”</span>}
              </span>
              <span className="flex items-center">
                {!r.response && (
                  <button type="button" className={ghost} onClick={() => void copy(fullLink(window.location.origin, r.path))}>
                    {copied === fullLink(window.location.origin, r.path) ? 'Đã chép' : 'Chép link'}
                  </button>
                )}
                <button type="button" className={danger} onClick={() => void removeResponse(r)} aria-label={`Xoá câu trả lời của ${r.name}`}>
                  Xoá
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
