import { describe, expect, it } from 'vitest';
import { adminStatusLabel, canDisable, promotable, type FamilyAdmin } from './admins';

const admin = (id: number, status: FamilyAdmin['status']): FamilyAdmin => ({ id, email: `a${id}@x.vn`, full_name: `A${id}`, status, last_login_at: null });

describe('family admins helpers', () => {
  it('labels the status', () => {
    expect(adminStatusLabel('active')).toBe('Đang hoạt động');
    expect(adminStatusLabel('disabled')).toBe('Đã vô hiệu hoá');
    expect(adminStatusLabel('pending')).toBe('Chờ duyệt');
  });
  it('only offers "disable" while another admin stays active', () => {
    expect(canDisable([admin(1, 'active')], admin(1, 'active'))).toBe(false);
    expect(canDisable([admin(1, 'active'), admin(2, 'active')], admin(1, 'active'))).toBe(true);
    expect(canDisable([admin(1, 'active'), admin(2, 'disabled')], admin(1, 'active'))).toBe(false);
    expect(canDisable([admin(1, 'active'), admin(2, 'disabled')], admin(2, 'disabled'))).toBe(true); // an already-disabled one is not "removing" anybody
  });
  it('lists the family users who are not admins yet, by name', () => {
    const users = [
      { id: 1, email: 'b@x.vn', full_name: 'Bình', role: 'member', status: 'active' },
      { id: 2, email: 'a@x.vn', full_name: 'An', role: 'admin', status: 'active' },
      { id: 3, email: 'c@x.vn', full_name: 'An Khác', role: 'member', status: 'pending' },
    ];
    expect(promotable(users).map((u) => u.id)).toEqual([3, 1]);
  });
});
