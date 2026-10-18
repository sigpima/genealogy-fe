'use client';

import { useEffect, useState } from 'react';
import { backupSummary, formatBytes } from '@/lib/admin/backup';
import {
  databaseSummary,
  diskSummary,
  emailSummary,
  storageSummary,
  workerSummary,
  type PlatformHealth,
  type Summary,
} from '@/lib/platform/system';

function Card({ label, summary, children }: { label: string; summary: Summary; children?: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      className={`rounded-2xl border bg-surface p-4 ${summary.tone === 'warn' ? 'border-[var(--color-danger)]' : 'border-default'}`}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</h2>
      <p className="mt-1 text-lg font-semibold text-default">
        {summary.tone === 'warn' && <span className="me-2 rounded-full border-2 border-[var(--color-danger)] px-2 py-0.5 text-sm font-semibold">Cần chú ý</span>}
        {summary.headline}
      </p>
      <p className="mt-1 text-base text-muted">{summary.detail}</p>
      {children}
    </section>
  );
}

/** The server itself: database, reminder worker, e-mail, disk, storage and the full backup status. Read-only. */
export function SystemView() {
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/platform/health', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<PlatformHealth>) : Promise.reject()))
      .then(setHealth)
      .catch(() => setError('Không đọc được tình trạng hệ thống. Vui lòng thử lại.'));
  }, []);

  if (error) return <p role="alert" className="text-base text-danger">{error}</p>;
  if (!health) return <p className="text-base text-muted">Đang kiểm tra...</p>;

  const backup = backupSummary(health.backup);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card label="Cơ sở dữ liệu" summary={databaseSummary(health.database)} />
      <Card label="Bộ nhắc việc" summary={workerSummary(health.worker)} />
      <Card label="Gửi email" summary={emailSummary(health.email)} />
      <Card label="Ổ đĩa" summary={diskSummary(health.disk)} />
      <Card label="Dung lượng ảnh" summary={storageSummary(health.storage)} />
      <Card label="Sao lưu" summary={backup}>
        {health.backup.members !== null && <p className="mt-1 text-base text-default">Bản gần nhất ghi {health.backup.members} người trong cả hệ thống.</p>}
        {health.backup.recent.length > 0 && (
          <ul className="mt-2 divide-y divide-[var(--color-border)] text-base text-default">
            {health.backup.recent.map((b) => (
              <li key={b.name} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1">
                <span className="break-all">{b.name}</span>
                <span className="text-sm text-muted">{formatBytes(b.size_bytes)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-base text-muted">Sao lưu và khôi phục vẫn làm bằng <code className="rounded bg-surface-muted px-1">scripts/backup.sh</code> / <code className="rounded bg-surface-muted px-1">scripts/restore.sh</code> trên máy chủ (docs/SAO-LUU.md).</p>
      </Card>
    </div>
  );
}
