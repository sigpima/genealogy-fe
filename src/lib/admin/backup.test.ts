import { describe, expect, it } from 'vitest';
import { backupSummary, formatBytes, type BackupStatus } from './backup';

const status = (patch: Partial<BackupStatus>): BackupStatus => ({ state: 'ok', last_at: '2026-10-15T02:00:00+07:00', age_days: 3, size_bytes: 1234, kept: 2, ...patch });

describe('backupSummary', () => {
  it('reports a recent backup calmly, with its date in Vietnam time', () => {
    const s = backupSummary(status({}));
    expect(s.tone).toBe('ok');
    expect(s.headline).toBe('Bản sao lưu gần nhất: 3 ngày trước (15/10/2026 02:00)');
    expect(s.detail).toBe('Dung lượng 1,2 KB · đang giữ 2 bản.');
  });
  it('says "hôm nay" for today', () => {
    expect(backupSummary(status({ age_days: 0 })).headline).toContain('hôm nay');
  });
  it('warns when the last backup is old', () => {
    const s = backupSummary(status({ state: 'old', age_days: 9, last_at: '2026-10-09T02:00:00+07:00' }));
    expect(s.tone).toBe('warn');
    expect(s.headline).toBe('Bản sao lưu gần nhất đã 9 ngày tuổi (09/10/2026 02:00)');
  });
  it('warns and explains what to do when there is none', () => {
    const s = backupSummary({ state: 'never', last_at: null, age_days: null, size_bytes: null, kept: 0 });
    expect(s.tone).toBe('warn');
    expect(s.headline).toBe('Chưa có bản sao lưu nào được ghi nhận trên máy chủ');
    expect(s.detail).toMatch(/scripts\/backup\.sh/);
  });
});

describe('formatBytes', () => {
  it('uses a decimal comma and the right unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1234)).toBe('1,2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3,0 GB');
  });
});
