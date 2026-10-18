'use client';

import { useEffect, useState } from 'react';
import { PersonPicker, type PickedPerson } from '@/components/common/PersonPicker';
import { relationLines, type Relationship } from '@/lib/tree/relationship';

const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

/** "Quan hệ họ hàng": pick somebody and see who each is to the other, in Vietnamese kinship terms. */
export function RelationshipDialog({
  memberId,
  memberName,
  myMember = null,
  onClose,
}: {
  memberId: number;
  memberName: string;
  /** The person the signed-in account is, for the one-tap "Xem với tôi". */
  myMember?: PickedPerson | null;
  onClose: () => void;
}) {
  const [other, setOther] = useState<PickedPerson | null>(null);
  const [result, setResult] = useState<Relationship | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!other) return;
    let cancelled = false;
    setResult(null);
    setError(null);
    fetch(`/api/members/relationship?${new URLSearchParams({ a: String(memberId), b: String(other.id) })}`, { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<Relationship>) : Promise.reject()))
      .then((body) => !cancelled && setResult(body))
      .catch(() => !cancelled && setError('Không tính được quan hệ. Vui lòng thử lại.'));
    return () => {
      cancelled = true;
    };
  }, [other, memberId]);

  const lines = result && other ? relationLines(result, memberName, other.name) : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quan hệ họ hàng"
        onClick={(e) => e.stopPropagation()}
        className="shadow-float w-full max-w-md overflow-hidden rounded-t-2xl border-default border bg-surface sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-default border-b px-5 py-3">
          <h2 className="font-display text-lg font-bold text-default">Quan hệ họ hàng</h2>
          <button type="button" className={ghost} onClick={onClose}>
            Đóng ✕
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-muted">
            Xem <strong className="text-default">{memberName}</strong> và một người khác là gì của nhau.
          </p>
          {other ? (
            <p className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-sm text-default">
              <span>{other.name}</span>
              <button type="button" className={ghost} onClick={() => { setOther(null); setResult(null); }}>
                Chọn người khác
              </button>
            </p>
          ) : (
            <>
              {myMember && myMember.id !== memberId && (
                <button
                  type="button"
                  onClick={() => setOther(myMember)}
                  className="min-h-11 w-full rounded-lg border-default border bg-surface px-3 text-sm font-medium text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  Xem với tôi ({myMember.name})
                </button>
              )}
              <PersonPicker label="Chọn người để so sánh" placeholder="Gõ tên người cần xem quan hệ..." excludeIds={[memberId]} onPick={setOther} />
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {result && (
            <div role="status" aria-label="Kết quả quan hệ" className="space-y-1 rounded-xl border-default border p-3 text-sm text-default">
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
