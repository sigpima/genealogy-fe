'use client';

import { useState } from 'react';

const primary =
  'min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

type Flags = { chronicles: boolean; profiles: boolean; diagram: boolean; notes: boolean; photos: boolean; contacts: boolean };

const OPTIONS: { key: keyof Flags; label: string; hint: string }[] = [
  { key: 'chronicles', label: 'Sử ký, tộc ước, bài đệm, dòng thời gian', hint: 'Chỉ bài đã đăng; bản nháp không bao giờ được in.' },
  { key: 'profiles', label: 'Phả hệ theo đời', hint: 'Mỗi người một khối: ngày sinh/mất, vợ/chồng, con, nơi an nghỉ.' },
  { key: 'diagram', label: 'Phả đồ (sơ đồ cây)', hint: 'Các nhánh được cắt thành nhiều trang khổ A3 ngang để chữ đủ lớn.' },
  { key: 'notes', label: 'Ghi chú của từng người', hint: 'Bỏ chọn nếu ghi chú chỉ để nội bộ.' },
  { key: 'photos', label: 'Ảnh chân dung', hint: 'Làm file nặng hơn.' },
  { key: 'contacts', label: 'Số điện thoại và email', hint: 'Mặc định KHÔNG in. Chỉ bật khi quyển phả chỉ để trong nhà.' },
];

export function BookView({ canManage }: { canManage: boolean }) {
  const [flags, setFlags] = useState<Flags>({ chronicles: true, profiles: true, diagram: true, notes: true, photos: false, contacts: false });
  const [maxGeneration, setMaxGeneration] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!canManage) {
    return <p className="p-6 text-sm text-muted">Chỉ quản trị viên của họ mới xuất được quyển phả.</p>;
  }

  async function make() {
    setBusy(true);
    setMessage(null);
    try {
      const query = new URLSearchParams(Object.entries(flags).map(([k, v]) => [k, String(v)]));
      const generation = Number(maxGeneration);
      if (Number.isInteger(generation) && generation >= 1) query.set('max_generation', String(generation));
      const response = await fetch(`/api/book.pdf?${query}`, { credentials: 'include' });
      if (!response.ok) {
        setMessage({ ok: false, text: response.status === 403 ? 'Bạn không có quyền xuất quyển phả.' : 'Không soạn được quyển phả. Vui lòng thử lại.' });
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'gia-pha.pdf';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage({ ok: true, text: `Đã tải ${name} (${(blob.size / 1024 / 1024).toFixed(1)} MB).` });
    } catch {
      setMessage({ ok: false, text: 'Mất kết nối khi soạn quyển phả. Vui lòng thử lại.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-default">Xuất bản quyển phả</h1>
        <p className="mt-1 text-sm text-muted">Tạo một file PDF có bìa, mục lục, sử ký, phả hệ theo đời và phả đồ để in thành sách. Việc soạn có thể mất vài chục giây với họ lớn.</p>
      </header>
      <section aria-label="Nội dung quyển phả" className="space-y-1 rounded-xl border-default border bg-surface p-4">
        {OPTIONS.map((o) => (
          <label key={o.key} className="flex min-h-11 items-start gap-3 py-1.5 text-sm text-default">
            <input type="checkbox" checked={flags[o.key]} onChange={(e) => setFlags({ ...flags, [o.key]: e.target.checked })} className="mt-1 size-4 accent-[var(--color-primary)]" />
            <span>
              {o.label}
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
        <label className="block pt-2 text-sm">
          <span className="text-xs text-muted">Chỉ in đến đời thứ (để trống = tất cả)</span>
          <input aria-label="Đến đời" inputMode="numeric" value={maxGeneration} onChange={(e) => setMaxGeneration(e.target.value.replace(/\D/g, ''))} className="mt-1 w-32 min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default" />
        </label>
      </section>
      <div className="flex items-center gap-3">
        <button type="button" className={primary} disabled={busy} onClick={() => void make()}>
          {busy ? 'Đang soạn quyển phả…' : 'Soạn và tải PDF'}
        </button>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-default' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
      </div>
      <p className="text-xs text-muted">Mỗi lần xuất được ghi vào Nhật ký. Muốn ảnh của riêng cây, dùng nút “Xuất ảnh” ở trang Cây Gia Phả.</p>
    </div>
  );
}
