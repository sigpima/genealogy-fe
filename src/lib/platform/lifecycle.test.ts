import { describe, expect, it } from 'vitest';
import { canDelete, deleteSummary, filterTrees, lastActivityLabel, statusLabel } from './lifecycle';
import type { PlatformTree } from './trees';

const tree = (patch: Partial<PlatformTree>): PlatformTree => ({
  id: 1, name: 'Họ A', slug: 'ho-a', member_count: 12, user_count: 3, admins: [{ id: 1, email: 'a@x.vn', full_name: 'A', status: 'active' }],
  is_current: false, last_activity: null, status: 'active', ...patch,
});

describe('lifecycle helpers', () => {
  it('labels the status', () => {
    expect(statusLabel('active')).toBe('Đang hoạt động');
    expect(statusLabel('paused')).toBe('Đã tạm ngưng');
  });
  it('says when a family was last active', () => {
    const now = new Date('2026-10-18T12:00:00+07:00');
    expect(lastActivityLabel(null, now)).toBe('Chưa có hoạt động');
    expect(lastActivityLabel('2026-10-18T08:00:00+07:00', now)).toBe('Hôm nay');
    expect(lastActivityLabel('2026-10-10T08:00:00+07:00', now)).toBe('10/10/2026');
  });
  it('only lets a paused family be deleted, and only after the slug is typed exactly', () => {
    expect(canDelete(tree({ status: 'active' }), 'ho-a')).toBe(false);
    expect(canDelete(tree({ status: 'paused' }), 'ho-a')).toBe(true);
    expect(canDelete(tree({ status: 'paused' }), ' ho-a ')).toBe(true);
    expect(canDelete(tree({ status: 'paused' }), 'HO-A')).toBe(false);
    expect(canDelete(tree({ status: 'paused' }), '')).toBe(false);
  });
  it('summarises what a deletion removes', () => {
    expect(deleteSummary(tree({}))).toBe('12 người trong cây, 3 tài khoản, cùng toàn bộ ảnh, tài liệu, bài viết, thiệp mời và nhật ký của họ này.');
  });
  it('filters the list by the to-do link', () => {
    const list = [tree({ id: 1 }), tree({ id: 2, status: 'paused' }), tree({ id: 3, admins: [{ id: 9, email: 'b@x.vn', full_name: 'B', status: 'disabled' }] }), tree({ id: 4, status: 'paused', admins: [] })];
    expect(filterTrees(list, 'tam-ngung').map((t) => t.id)).toEqual([2, 4]);
    expect(filterTrees(list, 'khong-admin').map((t) => t.id)).toEqual([3]); // paused families are not counted: their admins do not matter until resumed
    expect(filterTrees(list, null).map((t) => t.id)).toEqual([1, 2, 3, 4]);
    expect(filterTrees(list, 'bogus').map((t) => t.id)).toEqual([1, 2, 3, 4]);
  });
});
describe('login message for a paused family', () => {
  it('explains it', async () => {
    const { loginErrorMessage } = await import('../auth/session');
    expect(loginErrorMessage(403, 'tree_paused')).toMatch(/tạm ngưng/);
  });
});
