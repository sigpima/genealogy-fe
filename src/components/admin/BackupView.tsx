'use client';

import { useEffect, useState } from 'react';
import { backupSummary, type BackupStatus } from '@/lib/admin/backup';

/** Status of the host's backups. Read-only on purpose: a backup holds every family's data, so there is no button to make or download one. */
export function BackupView() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/backup-status', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<BackupStatus>) : Promise.reject()))
      .then(setStatus)
      .catch(() => setError('Không đọc được tình trạng sao lưu. Vui lòng thử lại.'));
  }, []);

  if (error) return <p role="alert" className="text-base text-danger">{error}</p>;
  if (!status) return <p className="text-base text-muted">Đang đọc...</p>;
  const summary = backupSummary(status);

  return (
    <div className="space-y-6">
      <section
        aria-label="Tình trạng sao lưu"
        className={`rounded-2xl border p-4 ${summary.tone === 'warn' ? 'border-[var(--color-danger)]' : 'border-default'} bg-surface`}
      >
        <p role="status" className="text-lg font-semibold text-default">
          {summary.tone === 'warn' && <span className="me-2 rounded-full border-2 border-[var(--color-danger)] px-2 py-0.5 text-sm font-semibold text-default">Cần chú ý</span>}
          {summary.headline}
        </p>
        <p className="mt-2 text-base text-muted">{summary.detail}</p>
      </section>

      <section aria-label="Cách sao lưu" className="rounded-2xl border-default border bg-surface p-4">
        <h2 className="text-lg font-semibold text-default">Cách sao lưu</h2>
        <ol className="mt-2 list-decimal space-y-2 ps-6 text-base text-default">
          <li>Trên máy chủ, trong thư mục dự án, chạy <code className="rounded bg-surface-muted px-1">scripts/backup.sh</code> — nó lưu cả cơ sở dữ liệu lẫn ảnh/tài liệu.</li>
          <li>Đặt chạy mỗi đêm bằng cron (dòng mẫu trong <code className="rounded bg-surface-muted px-1">docs/SAO-LUU.md</code>).</li>
          <li>Chép thư mục <code className="rounded bg-surface-muted px-1">backups/</code> sang ổ khác hoặc máy khác: bản sao lưu nằm cùng ổ với dữ liệu thì không cứu được khi hỏng ổ.</li>
          <li>Thỉnh thoảng thử khôi phục vào một cơ sở dữ liệu thử (<code className="rounded bg-surface-muted px-1">scripts/restore.sh</code>) để chắc bản sao lưu dùng được.</li>
        </ol>
        <p className="mt-3 text-base text-muted">Trang này không tạo hay tải bản sao lưu: mỗi bản chứa dữ liệu của mọi họ trên máy chủ nên chỉ người quản lý máy chủ được chạm vào.</p>
      </section>
    </div>
  );
}
