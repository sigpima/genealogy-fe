import { formatBytes, type BackupStatus } from '../admin/backup';

export type PlatformHealth = {
  database: { ok: boolean; revision: string | null };
  worker: { state: 'ok' | 'stale' | 'unknown'; last_run: string | null; age_minutes: number | null };
  email: { configured: boolean };
  disk: { total_bytes: number; free_bytes: number; free_percent: number };
  storage: { media_bytes: number; avatar_bytes: number };
  backup: BackupStatus & { members: number | null; recent: { name: string; last_at: string; size_bytes: number }[] };
};

export type Summary = { tone: 'ok' | 'warn' | 'neutral'; headline: string; detail: string };

export function ageLabel(minutes: number): string {
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ trước`;
  return `${Math.floor(minutes / (24 * 60))} ngày trước`;
}

export function workerSummary(w: PlatformHealth['worker']): Summary {
  if (w.state === 'unknown' || w.age_minutes === null) {
    return { tone: 'neutral', headline: 'Chưa có dữ liệu về bộ nhắc việc', detail: 'Bộ nhắc việc (service worker) ghi một dấu mốc sau mỗi lần chạy, mỗi giờ một lần. Chưa thấy lần nào: máy chủ mới dựng, hoặc service này chưa chạy.' };
  }
  if (w.state === 'stale') {
    return { tone: 'warn', headline: `Bộ nhắc việc đã ${Math.floor(w.age_minutes / 60)} giờ không chạy`, detail: 'Thông báo giỗ và email nhắc việc sẽ không đến cho tới khi service worker chạy lại (docker compose up -d worker).' };
  }
  return { tone: 'ok', headline: `Bộ nhắc việc chạy lần cuối ${ageLabel(w.age_minutes)}`, detail: 'Mỗi giờ một lần.' };
}

export function diskSummary(d: PlatformHealth['disk']): Summary {
  const headline = `Ổ đĩa còn trống ${d.free_percent}% (${formatBytes(d.free_bytes)} / ${formatBytes(d.total_bytes)})`;
  return d.free_percent < 15
    ? { tone: 'warn', headline, detail: 'Sắp đầy: ảnh tải lên và bản sao lưu sẽ lỗi khi hết chỗ. Dọn bớt bản sao lưu cũ hoặc thêm dung lượng.' }
    : { tone: 'ok', headline, detail: 'Đủ rộng.' };
}

export function databaseSummary(db: PlatformHealth['database']): Summary {
  return db.ok
    ? { tone: 'ok', headline: 'Cơ sở dữ liệu hoạt động', detail: `Phiên bản cấu trúc: ${db.revision ?? 'không rõ'}` }
    : { tone: 'warn', headline: 'Không truy vấn được cơ sở dữ liệu', detail: 'Xem nhật ký của service db và api trên máy chủ.' };
}

export function emailSummary(e: PlatformHealth['email']): Summary {
  return e.configured
    ? { tone: 'ok', headline: 'Đã cấu hình gửi email', detail: 'Quên mật khẩu, nhắc việc và thông báo yêu cầu có thể gửi thư.' }
    : { tone: 'neutral', headline: 'Chưa cấu hình gửi email', detail: 'Nhắc việc chỉ hiện trong web; thư quên mật khẩu không được gửi (đặt SMTP_HOST... trong .env để bật).' };
}

export function storageSummary(s: PlatformHealth['storage']): Summary {
  return { tone: 'neutral', headline: `Ảnh và tài liệu: ${formatBytes(s.media_bytes)} · ảnh chân dung: ${formatBytes(s.avatar_bytes)}`, detail: 'Tổng của mọi họ.' };
}
