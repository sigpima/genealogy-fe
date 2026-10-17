'use client';

import { useEffect, useRef, useState } from 'react';
import {
  changesFromForm,
  childChanges,
  fieldLabel,
  requestErrorMessage,
  type ProposeForm,
  type RequestKind,
} from '@/lib/requests/requests';
import type { Gender } from '@/lib/tree/types';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

export type ProposeDialogProps = {
  memberId: number;
  memberName: string;
  /** What the person's data is now; only fields the sender changes are proposed. */
  initial: ProposeForm;
  onClose: () => void;
};

const TABS: { id: RequestKind; label: string }[] = [
  { id: 'edit', label: 'Sửa thông tin' },
  { id: 'add_child', label: 'Thêm con' },
  { id: 'report', label: 'Báo sai / bổ sung' },
];

/** A member's way to suggest a change: nothing is written to the tree until an admin approves. */
export function ProposeDialog({ memberId, memberName, initial, onClose }: ProposeDialogProps) {
  const [kind, setKind] = useState<RequestKind>('edit');
  const [form, setForm] = useState<ProposeForm>(initial);
  const [childName, setChildName] = useState('');
  const [childGender, setChildGender] = useState<'' | Gender>('');
  const [childYear, setChildYear] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof ProposeForm>(key: K, value: ProposeForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    let changes: Record<string, unknown> = {};
    if (kind === 'edit') {
      const result = changesFromForm(initial, form);
      if (!result.ok) return setError(result.error);
      if (Object.keys(result.changes).length === 0) return setError('Bạn chưa thay đổi gì so với thông tin hiện có.');
      changes = result.changes;
    } else if (kind === 'add_child') {
      const result = childChanges(childName, childGender, childYear);
      if (!result.ok) return setError(result.error);
      changes = result.changes;
    } else if (message.trim().length < 5) {
      return setError('Hãy mô tả điều cần sửa (ít nhất 5 ký tự).');
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, member_id: memberId, changes, message: message.trim() || null }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setError(requestErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail));
        return;
      }
      setSent(true);
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="propose-title"
        className="shadow-float flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-default border bg-surface outline-none sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-default border-b px-5 pt-4">
          <h2 id="propose-title" className="font-display text-lg font-bold text-default">
            Đề xuất chỉnh sửa · {memberName}
          </h2>
          <p className="mt-1 text-xs text-muted">Quản trị viên sẽ xem và duyệt. Gia phả chỉ thay đổi sau khi được duyệt.</p>
          {!sent && (
            <div role="tablist" aria-label="Loại đề xuất" className="mt-2 flex">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={kind === tab.id}
                  onClick={() => {
                    setKind(tab.id);
                    setError(null);
                  }}
                  className={`min-h-11 border-b-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                    kind === tab.id ? 'border-[var(--color-primary)] text-primary' : 'border-transparent text-muted hover:text-default'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sent ? (
            <div role="status" className="space-y-2 text-sm text-default">
              <p className="font-medium">Đã gửi đề xuất. Cảm ơn bạn!</p>
              <p className="text-muted">Xem trạng thái ở mục “Yêu cầu” trên menu; bạn sẽ nhận email khi có kết quả (nếu hệ thống đã cấu hình gửi mail).</p>
            </div>
          ) : (
            <>
              {kind === 'edit' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Text label="Họ tên" value={form.full_name} onChange={(v) => set('full_name', v)} wide />
                  <label className="block text-sm">
                    <span className="text-xs text-muted">Giới tính</span>
                    <select value={form.gender} onChange={(e) => set('gender', e.target.value as '' | Gender)} aria-label="Giới tính" className={field}>
                      <option value="">Không rõ</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </label>
                  <Text label="Con thứ" value={form.birth_order} onChange={(v) => set('birth_order', v)} />
                  <Text label="Năm sinh" value={form.birth_year} onChange={(v) => set('birth_year', v)} />
                  <Text label="Năm mất" value={form.death_year} onChange={(v) => set('death_year', v)} />
                  <Text label="Tháng sinh" value={form.birth_month} onChange={(v) => set('birth_month', v)} />
                  <Text label="Ngày sinh" value={form.birth_day} onChange={(v) => set('birth_day', v)} />
                  <Text label="Tháng mất" value={form.death_month} onChange={(v) => set('death_month', v)} />
                  <Text label="Ngày mất" value={form.death_day} onChange={(v) => set('death_day', v)} />
                  <label className="flex min-h-11 items-center gap-x-2 text-sm text-default">
                    <input type="checkbox" checked={form.birth_is_lunar} onChange={(e) => set('birth_is_lunar', e.target.checked)} />
                    Ngày sinh theo âm lịch
                  </label>
                  <label className="flex min-h-11 items-center gap-x-2 text-sm text-default">
                    <input type="checkbox" checked={form.death_is_lunar} onChange={(e) => set('death_is_lunar', e.target.checked)} />
                    Ngày mất (giỗ) theo âm lịch
                  </label>
                  <Text label="Quê quán" value={form.hometown} onChange={(v) => set('hometown', v)} />
                  <Text label="Nơi ở" value={form.residence} onChange={(v) => set('residence', v)} />
                  <Text label="Tên tự" value={form.courtesy_name} onChange={(v) => set('courtesy_name', v)} />
                  <Text label="Chức vị" value={form.title} onChange={(v) => set('title', v)} />
                  <Text label="Điện thoại" value={form.phone} onChange={(v) => set('phone', v)} />
                  <Text label="Email" value={form.email} onChange={(v) => set('email', v)} />
                  <Text label="Mộ phần" value={form.burial_place} onChange={(v) => set('burial_place', v)} wide />
                  <label className="flex min-h-11 items-center gap-x-2 text-sm text-default sm:col-span-2">
                    <input type="checkbox" checked={form.is_adopted} onChange={(e) => set('is_adopted', e.target.checked)} />
                    Con nuôi
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-xs text-muted">{fieldLabel('notes')}</span>
                    <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} aria-label="Ghi chú" className={`${field} py-2`} />
                  </label>
                </div>
              )}
              {kind === 'add_child' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Text label="Họ tên người con" value={childName} onChange={setChildName} wide />
                  <label className="block text-sm">
                    <span className="text-xs text-muted">Giới tính</span>
                    <select value={childGender} onChange={(e) => setChildGender(e.target.value as '' | Gender)} aria-label="Giới tính người con" className={field}>
                      <option value="">Không rõ</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </label>
                  <Text label="Năm sinh" value={childYear} onChange={setChildYear} />
                </div>
              )}
              <label className="mt-3 block text-sm">
                <span className="text-xs text-muted">
                  {kind === 'report' ? 'Điều cần sửa / bổ sung' : 'Lời nhắn cho quản trị viên (tuỳ chọn, vd: nguồn thông tin)'}
                </span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} aria-label="Lời nhắn" className={`${field} py-2`} />
              </label>
              {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-x-2 border-default border-t px-5 py-3">
          {sent ? (
            <button type="button" className={primary} onClick={onClose}>
              Đóng
            </button>
          ) : (
            <>
              <button type="button" className={ghost} onClick={onClose}>
                Huỷ
              </button>
              <button type="button" className={primary} disabled={busy} onClick={() => void submit()}>
                Gửi đề xuất
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Text({ label, value, onChange, wide }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <label className={`block text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={field} />
    </label>
  );
}
