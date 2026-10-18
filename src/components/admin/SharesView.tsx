'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { feedUrl } from '@/lib/calendar/calendar';
import { fullLink, longDate } from '@/lib/invitations/invitations';
import type { Card } from '@/lib/invitations/invitations';

type Subscription = { enabled: boolean; path: string | null };
type Ask = { title: string; message: string; confirm: string; run: () => Promise<void> };

const button =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-base font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

/** The links this family has handed out: the phone-calendar feed and the invitation cards that still take answers. */
export function SharesView() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sub, open] = await Promise.all([
        fetch('/api/calendar/subscription', { credentials: 'include' }),
        fetch('/api/cards?open=true', { credentials: 'include' }),
      ]);
      if (sub.ok) setSubscription((await sub.json()) as Subscription);
      if (open.ok) setCards((await open.json()) as Card[]);
      if (!sub.ok || !open.ok) setMessage({ kind: 'error', text: 'Không tải được đủ thông tin. Vui lòng thử lại.' });
    } catch {
      setMessage({ kind: 'error', text: 'Không thể kết nối tới máy chủ.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmed() {
    if (!ask) return;
    setBusy(true);
    try {
      await ask.run();
    } finally {
      setBusy(false);
      setAsk(null);
    }
  }

  async function calendar(method: 'POST' | 'DELETE', okText: string) {
    const response = await fetch('/api/calendar/subscription', { method, credentials: 'include' });
    setMessage(response.ok ? { kind: 'ok', text: okText } : { kind: 'error', text: 'Không thể thực hiện. Vui lòng thử lại.' });
    await load();
  }

  async function closeCard(card: Card) {
    const response = await fetch(`/api/cards/${card.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true }),
    });
    setMessage(response.ok ? { kind: 'ok', text: 'Đã đóng thiệp.' } : { kind: 'error', text: 'Không đóng được thiệp. Vui lòng thử lại.' });
    await load();
  }

  const url = subscription?.path ? feedUrl(window.location.origin, subscription.path) : null;

  return (
    <div className="space-y-8">
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-base ${message.kind === 'error' ? 'text-danger' : 'text-default'}`}>
          {message.text}
        </p>
      )}

      <section aria-label="Link lịch điện thoại" className="rounded-2xl border-default border bg-surface p-4">
        <h2 className="text-lg font-semibold text-default">Link lịch điện thoại</h2>
        <p className="mt-1 text-base text-muted">Ai có link này đều xem được lịch giỗ và sự kiện của họ. Tạo link mới hoặc tắt link sẽ cắt các điện thoại đang dùng link cũ.</p>
        {!subscription && <p className="mt-2 text-base text-muted">Đang tải...</p>}
        {subscription && !url && (
          <div className="mt-3">
            <p className="text-base text-default">Link lịch đang tắt.</p>
            <button type="button" disabled={busy} className={`${button} mt-2 bg-primary text-on-primary hover:opacity-90`} onClick={() => void calendar('POST', 'Đã bật link lịch.')}>
              Bật link lịch
            </button>
          </div>
        )}
        {url && (
          <div className="mt-3 space-y-2">
            <input readOnly value={url} aria-label="Link lịch" onFocus={(e) => e.currentTarget.select()} className="w-full min-h-11 rounded-lg border-default border bg-app px-3 font-mono text-sm text-default" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${button} border-default border text-default hover:bg-surface-muted`}
                onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied('calendar')).catch(() => undefined)}
              >
                {copied === 'calendar' ? 'Đã chép' : 'Chép link'}
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${button} text-default hover:bg-surface-muted`}
                onClick={() => setAsk({ title: 'Tạo link lịch mới?', message: 'Link cũ trên các điện thoại sẽ ngừng cập nhật. Bạn cần gửi link mới cho mọi người.', confirm: 'Tạo link mới', run: () => calendar('POST', 'Đã tạo link lịch mới.') })}
              >
                Tạo link mới
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${button} text-danger hover:underline`}
                onClick={() => setAsk({ title: 'Tắt link lịch?', message: 'Các điện thoại đang dùng link này sẽ không nhận lịch nữa. Bạn có thể bật lại sau (sẽ là link mới).', confirm: 'Tắt link', run: () => calendar('DELETE', 'Đã tắt link lịch.') })}
              >
                Tắt link
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Thiệp mời đang mở" className="rounded-2xl border-default border bg-surface p-4">
        <h2 className="text-lg font-semibold text-default">Thiệp mời đang mở{cards ? ` (${cards.length})` : ''}</h2>
        <p className="mt-1 text-base text-muted">Những thiệp khách còn trả lời được. Đóng thiệp để link vẫn xem được nhưng không nhận thêm câu trả lời.</p>
        {cards && cards.length === 0 && <p className="mt-2 text-base text-muted">Không có thiệp nào đang mở.</p>}
        <ul className="mt-3 space-y-3">
          {(cards ?? []).map((card) => (
            <li key={card.id} className="rounded-xl border-default border p-3">
              <p className="text-base font-semibold text-default">{card.event_title}</p>
              <p className="text-base text-muted">
                {longDate(card.date)} · {card.counts.yes} tham dự ({card.counts.people} người) · {card.counts.pending} chưa trả lời
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${button} border-default border text-default hover:bg-surface-muted`}
                  onClick={() => void navigator.clipboard?.writeText(fullLink(window.location.origin, card.path)).then(() => setCopied(`card-${card.id}`)).catch(() => undefined)}
                >
                  {copied === `card-${card.id}` ? 'Đã chép' : 'Chép link thiệp'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={`${button} text-danger hover:underline`}
                  onClick={() => setAsk({ title: `Đóng thiệp ${card.event_title}?`, message: 'Khách vẫn mở được link để xem nhưng không trả lời thêm được.', confirm: 'Đóng thiệp', run: () => closeCard(card) })}
                >
                  Đóng thiệp
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {ask && <ConfirmDialog title={ask.title} message={ask.message} confirmLabel={ask.confirm} danger busy={busy} onConfirm={() => void confirmed()} onCancel={() => setAsk(null)} />}
    </div>
  );
}
