export type BackupStatus = {
  state: 'never' | 'ok' | 'old';
  last_at: string | null;
  age_days: number | null;
  size_bytes: number | null;
  kept: number;
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1).replace('.', ',')} ${units[unit]}`;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function vnDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** One calm sentence and one line of detail for the backup page; `warn` when there is none or it is old. */
export function backupSummary(s: BackupStatus): { tone: 'ok' | 'warn'; headline: string; detail: string } {
  if (s.state === 'never' || !s.last_at) {
    return {
      tone: 'warn',
      headline: 'Chưa có bản sao lưu nào được ghi nhận trên máy chủ',
      detail: 'Chạy scripts/backup.sh trên máy chủ (nên đặt chạy mỗi đêm bằng cron, xem docs/SAO-LUU.md). Trang này chỉ báo tình trạng, không tạo bản sao lưu.',
    };
  }
  const when = vnDateTime(s.last_at);
  const detail = `Dung lượng ${s.size_bytes !== null ? formatBytes(s.size_bytes) : 'không rõ'} · đang giữ ${s.kept} bản.`;
  if (s.state === 'old') return { tone: 'warn', headline: `Bản sao lưu gần nhất đã ${s.age_days} ngày tuổi (${when})`, detail };
  const ago = s.age_days === 0 ? 'hôm nay' : `${s.age_days} ngày trước`;
  return { tone: 'ok', headline: `Bản sao lưu gần nhất: ${ago} (${when})`, detail };
}
