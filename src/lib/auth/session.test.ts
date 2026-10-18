import { describe, expect, it } from 'vitest';
import {
  canEdit,
  canManage,
  loginErrorMessage,
  roleLabel,
  type CurrentUser,
} from './session';

const user = (role: 'superadmin' | 'admin' | 'member'): CurrentUser => ({
  id: 1,
  email: 'a@example.com',
  full_name: 'A',
  role,
  status: 'active',
  tree_id: role === 'superadmin' ? null : 1,
  tree_name: role === 'superadmin' ? null : 'Họ A',
});

describe('canEdit / canManage', () => {
  it('is true for admins and superadmins, false for members', () => {
    for (const check of [canEdit, canManage]) {
      expect(check(user('admin'))).toBe(true);
      expect(check(user('superadmin'))).toBe(true);
      expect(check(user('member'))).toBe(false);
    }
  });
  it('is false for a guest', () => {
    expect(canEdit(null)).toBe(false);
    expect(canManage(null)).toBe(false);
  });
});

describe('loginErrorMessage', () => {
  it('asks to wait after too many attempts', () => {
    expect(loginErrorMessage(429, undefined)).toMatch(/quá nhiều lần/);
  });
  it('explains a pending account', () => {
    expect(loginErrorMessage(403, 'account_pending')).toMatch(/chờ.*duyệt/i);
  });
  it('explains a disabled account', () => {
    expect(loginErrorMessage(403, 'account_disabled')).toMatch(
      /vô hiệu hoá|bị khoá/i,
    );
  });
  it('keeps the generic message for wrong credentials', () => {
    expect(loginErrorMessage(401, 'invalid credentials')).toBe(
      'Email hoặc mật khẩu không đúng.',
    );
  });
  it('does not blame the credentials for an unknown 403 or a server error', () => {
    expect(loginErrorMessage(403, 'whatever')).not.toMatch(
      /mật khẩu không đúng/,
    );
    expect(loginErrorMessage(500, undefined)).toMatch(/thử lại/i);
  });
});

describe('roleLabel', () => {
  it('uses Vietnamese labels', () => {
    expect(roleLabel('admin')).toBe('Quản trị viên');
    expect(roleLabel('member')).toBe('Thành viên');
    expect(roleLabel('superadmin')).toBe('Quản trị tối cao');
  });
});
