'use client';

import { useEffect, useState } from 'react';
import { EVENT_KIND_LABELS, type EventKind } from '@/lib/calendar/calendar';
import {
  answerPayload,
  invitationErrorMessage,
  longDate,
  lunarLine,
  RESPONSE_LABELS,
  storageKey,
  totalsLine,
  type PublicCard,
  type RespondResult,
  type RsvpResponse,
} from '@/lib/invitations/invitations';
import { directionsUrl } from '@/lib/places/places';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';

/**
 * The invitation card a guest opens from a link: no login, no menu. On the card's open link the guest types a name and the
 * browser remembers the personal token it gets back, so reopening the same link lets them change the answer.
 */
export function InvitationView({ token }: { token: string }) {
  const [card, setCard] = useState<PublicCard | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [personal, setPersonal] = useState<string | null>(null); // the token we answer to: the URL's own, or one remembered for an open link
  const [isOpenLink, setIsOpenLink] = useState(false);
  const [form, setForm] = useState({ name: '', response: '' as RsvpResponse | '', partySize: '1', note: '' });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let remembered: string | null = null;
      try {
        remembered = window.localStorage.getItem(storageKey(token));
      } catch {
        /* private mode: the guest just cannot edit later */
      }
      // First try the remembered personal token (an earlier answer through this open link); fall back to the URL's token.
      for (const candidate of remembered ? [remembered, token] : [token]) {
        try {
          const response = await fetch(`/api/invitations/${encodeURIComponent(candidate)}`);
          if (!response.ok) continue;
          const body = (await response.json()) as PublicCard;
          if (cancelled) return;
          setCard(body);
          setPersonal(candidate);
          setIsOpenLink(candidate === token && body.guest === null);
          if (body.guest) {
            setForm({ name: body.guest.name, response: body.guest.response ?? '', partySize: String(body.guest.party_size), note: body.guest.note ?? '' });
          }
          setState('ok');
          return;
        } catch {
          /* try the next candidate */
        }
      }
      if (!cancelled) setState('missing');
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!personal) return;
    const result = answerPayload(form, isOpenLink);
    if (!result.ok) return setError(result.error);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(personal)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.body),
      });
      if (!response.ok) return setError(invitationErrorMessage(response.status));
      const body = (await response.json()) as RespondResult;
      setCard(body);
      setPersonal(body.token);
      setIsOpenLink(false);
      setEditing(false);
      try {
        window.localStorage.setItem(storageKey(token), body.token);
      } catch {
        /* see above */
      }
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <Shell>Đang mở thiệp...</Shell>;
  if (state === 'missing' || !card) return <Shell>{invitationErrorMessage(404)}</Shell>;

  const answered = card.guest?.response != null && !editing;
  return (
    <main className="min-h-screen bg-app px-4 py-8">
      <article aria-label={`Thiệp mời ${card.title}`} className="shadow-float mx-auto max-w-lg overflow-hidden rounded-2xl border-2 border-[var(--color-accent)] bg-surface">
        <header className="bg-primary px-6 py-5 text-center text-on-primary">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">Thư mời</p>
          <p className="font-display mt-1 text-lg">{card.family}</p>
        </header>
        <div className="space-y-4 px-6 py-6 text-center">
          {card.kind && <p className="text-xs font-semibold uppercase tracking-wider text-muted">{EVENT_KIND_LABELS[card.kind as EventKind] ?? ''}</p>}
          <h1 className="font-display text-3xl font-bold text-default">{card.title}</h1>
          <div className="space-y-1 text-default">
            <p className="font-medium">{longDate(card.date)}{card.time_text ? ` · ${card.time_text}` : ''}</p>
            <p className="text-sm text-muted">{lunarLine(card.lunar)}</p>
          </div>
          {card.place && (
            <div className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-default">
              <p className="font-semibold">{card.place.name}</p>
              {card.place.address && <p className="text-muted">{card.place.address}</p>}
              {card.place.latitude !== null && card.place.longitude !== null && (
                <a href={directionsUrl(card.place.latitude, card.place.longitude)} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center text-primary underline">
                  Chỉ đường
                </a>
              )}
            </div>
          )}
          {card.message && <p className="font-display whitespace-pre-wrap text-base italic leading-7 text-default">“{card.message}”</p>}
          <p className="text-xs text-muted">{totalsLine(card.totals)}</p>
        </div>

        <div className="border-default border-t bg-app/60 px-6 py-6">
          {card.closed ? (
            <p role="status" className="text-center text-sm text-muted">
              Thiệp mời này đã đóng, không nhận thêm câu trả lời.
              {card.guest?.response && ` Câu trả lời của bạn: ${RESPONSE_LABELS[card.guest.response]}.`}
            </p>
          ) : answered ? (
            <div role="status" className="space-y-2 text-center text-sm text-default">
              <p className="font-medium">
                Cảm ơn {card.guest!.name}! Bạn đã trả lời: <b>{RESPONSE_LABELS[card.guest!.response!]}</b>
                {card.guest!.response === 'yes' ? ` (${card.guest!.party_size} người)` : ''}.
              </p>
              <button type="button" onClick={() => setEditing(true)} className="min-h-11 text-primary underline">
                Đổi câu trả lời
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 text-left" aria-label="Trả lời thiệp mời">
              <h2 className="font-display text-center text-lg font-bold text-default">{card.guest && !isOpenLink ? `Xin chào ${card.guest.name}` : 'Bạn có tham dự được không?'}</h2>
              {isOpenLink && (
                <label className="block text-sm">
                  <span className="text-xs text-muted">Họ tên của bạn</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} aria-label="Họ tên của bạn" className={field} />
                </label>
              )}
              <div role="radiogroup" aria-label="Câu trả lời" className="grid gap-2">
                {(Object.keys(RESPONSE_LABELS) as RsvpResponse[]).map((r) => (
                  <label
                    key={r}
                    className={`flex min-h-11 cursor-pointer items-center gap-x-3 rounded-lg border px-3 text-sm text-default ${form.response === r ? 'border-[var(--color-primary)] bg-surface-muted font-semibold' : 'border-default bg-surface'}`}
                  >
                    <input type="radio" name="response" value={r} checked={form.response === r} onChange={() => setForm({ ...form, response: r })} />
                    {RESPONSE_LABELS[r]}
                  </label>
                ))}
              </div>
              {form.response === 'yes' && (
                <label className="block text-sm">
                  <span className="text-xs text-muted">Số người đi cùng (tính cả bạn)</span>
                  <input type="number" min={1} max={20} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} aria-label="Số người" className={field} />
                </label>
              )}
              <label className="block text-sm">
                <span className="text-xs text-muted">Lời nhắn (tuỳ chọn)</span>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} maxLength={500} aria-label="Lời nhắn" className={`${field} py-2`} />
              </label>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="min-h-12 w-full rounded-lg bg-primary text-sm font-semibold text-on-primary hover:opacity-90 disabled:opacity-50">
                Gửi câu trả lời
              </button>
            </form>
          )}
        </div>
      </article>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-6 text-center">
      <p className="max-w-sm text-sm text-muted">{children}</p>
    </main>
  );
}
