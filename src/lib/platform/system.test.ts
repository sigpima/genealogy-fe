import { describe, expect, it } from 'vitest';
import { ageLabel, databaseSummary, diskSummary, emailSummary, storageSummary, workerSummary, type PlatformHealth } from './system';

describe('ageLabel', () => {
  it('uses minutes, hours then days', () => {
    expect(ageLabel(0)).toBe('vừa xong');
    expect(ageLabel(12)).toBe('12 phút trước');
    expect(ageLabel(125)).toBe('2 giờ trước');
    expect(ageLabel(3 * 24 * 60 + 5)).toBe('3 ngày trước');
  });
});

describe('summaries', () => {
  it('worker: unknown is neutral, fresh is ok, stale warns', () => {
    const w = (state: PlatformHealth['worker']['state'], age: number | null) => workerSummary({ state, last_run: null, age_minutes: age });
    expect(w('unknown', null)).toMatchObject({ tone: 'neutral', headline: 'Chưa có dữ liệu về bộ nhắc việc' });
    expect(w('ok', 12)).toMatchObject({ tone: 'ok', headline: 'Bộ nhắc việc chạy lần cuối 12 phút trước' });
    expect(w('stale', 250)).toMatchObject({ tone: 'warn', headline: 'Bộ nhắc việc đã 4 giờ không chạy' });
  });
  it('disk: warns under 15% free and shows sizes', () => {
    const gb = 1024 ** 3;
    expect(diskSummary({ total_bytes: 100 * gb, free_bytes: 50 * gb, free_percent: 50 })).toMatchObject({ tone: 'ok', headline: 'Ổ đĩa còn trống 50% (50,0 GB / 100,0 GB)' });
    expect(diskSummary({ total_bytes: 100 * gb, free_bytes: 10 * gb, free_percent: 10 }).tone).toBe('warn');
  });
  it('database and e-mail', () => {
    expect(databaseSummary({ ok: true, revision: 'd6a8b2c50f71' })).toMatchObject({ tone: 'ok', headline: 'Cơ sở dữ liệu hoạt động', detail: 'Phiên bản cấu trúc: d6a8b2c50f71' });
    expect(databaseSummary({ ok: false, revision: null }).tone).toBe('warn');
    expect(emailSummary({ configured: true }).tone).toBe('ok');
    expect(emailSummary({ configured: false })).toMatchObject({ tone: 'neutral' });
    expect(emailSummary({ configured: false }).detail).toMatch(/quên mật khẩu/);
  });
  it('storage', () => {
    expect(storageSummary({ media_bytes: 1048576, avatar_bytes: 2048 }).headline).toBe('Ảnh và tài liệu: 1,0 MB · ảnh chân dung: 2,0 KB');
  });
});
