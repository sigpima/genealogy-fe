import { describe, expect, it } from 'vitest';
import {
  canEdit,
  loginErrorMessage,
  roleLabel,
  signupNotice,
  signupResultMessage,
  type CurrentUser,
} from './session';

const user = (role: 'admin' | 'member'): CurrentUser => ({
  id: 1,
  email: 'a@example.com',
  full_name: 'A',
  role,
  status: 'active',
});

describe('canEdit', () => {
  it('is true only for an admin', () => {
    expect(canEdit(user('admin'))).toBe(true);
    expect(canEdit(user('member'))).toBe(false);
  });
  it('is false for a guest', () => {
    expect(canEdit(null)).toBe(false);
  });
});

describe('loginErrorMessage', () => {
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

describe('signupNotice', () => {
  it('tells people what will happen to their new account', () => {
    expect(
      signupNotice({ visibility: 'private', registration: 'approval' }),
    ).toMatch(/duyệt/);
    expect(
      signupNotice({ visibility: 'private', registration: 'open' }),
    ).toBeNull();
  });
  it('says registration is closed', () => {
    expect(
      signupNotice({ visibility: 'private', registration: 'closed' }),
    ).toMatch(/đóng/i);
  });
  it('shows nothing while the site info is unknown', () => {
    expect(signupNotice(null)).toBeNull();
  });
});

describe('signupResultMessage', () => {
  it('differs between a pending and an active new account', () => {
    expect(signupResultMessage('pending')).toMatch(/chờ.*duyệt/i);
    expect(signupResultMessage('active')).toBeNull();
  });
});

describe('roleLabel', () => {
  it('uses Vietnamese labels', () => {
    expect(roleLabel('admin')).toBe('Quản trị viên');
    expect(roleLabel('member')).toBe('Thành viên');
  });
});
