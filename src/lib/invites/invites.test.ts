import { describe, expect, it } from 'vitest';
import { acceptErrorMessage, inviteErrorMessage, inviteStatusLabel, inviteUrl, shouldFocusMe, tokenFromPath } from './invites';

describe('inviteUrl', () => {
  it('joins the site address and the path the API gave', () => {
    expect(inviteUrl('/moi/abc', 'https://gia-pha.example.com')).toBe('https://gia-pha.example.com/moi/abc');
    expect(inviteUrl('/moi/abc', 'http://192.168.1.5:3000/')).toBe('http://192.168.1.5:3000/moi/abc');
  });
});

describe('inviteStatusLabel', () => {
  it('names every status in Vietnamese', () => {
    expect(inviteStatusLabel('pending')).toBe('Đang chờ');
    expect(inviteStatusLabel('used')).toBe('Đã dùng');
    expect(inviteStatusLabel('expired')).toBe('Hết hạn');
    expect(inviteStatusLabel('revoked')).toBe('Đã thu hồi');
  });
});

describe('tokenFromPath', () => {
  it('reads the token out of /moi/<token>', () => {
    expect(tokenFromPath('/moi/abc-DEF_123')).toBe('abc-DEF_123');
    expect(tokenFromPath('/moi/abc/')).toBe('abc');
    expect(tokenFromPath('/khac/abc')).toBeNull();
    expect(tokenFromPath('/moi/')).toBeNull();
  });
});

describe('shouldFocusMe', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };
  it('is true once per browser session for a person', () => {
    const storage = memory();
    expect(shouldFocusMe(storage, 7)).toBe(true);
    expect(shouldFocusMe(storage, 7)).toBe(false);
    expect(shouldFocusMe(storage, 8)).toBe(true);
  });
  it('is false (never throws) when storage is not available', () => {
    expect(shouldFocusMe(null, 7)).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(shouldFocusMe(broken, 7)).toBe(false);
  });
});

describe('error messages', () => {
  it('explains a link that no longer works without saying why', () => {
    expect(inviteErrorMessage(404)).toMatch(/không còn hiệu lực/);
  });
  it('explains the failures of accepting', () => {
    expect(acceptErrorMessage(409, 'email already registered')).toMatch(/email/i);
    expect(acceptErrorMessage(409, 'that person already has an account')).toMatch(/đã có tài khoản/);
    expect(acceptErrorMessage(404, undefined)).toMatch(/không còn hiệu lực/);
    expect(acceptErrorMessage(422, undefined)).toMatch(/8 ký tự/);
    expect(acceptErrorMessage(429, undefined)).toMatch(/quá nhiều/);
    expect(acceptErrorMessage(500, undefined)).toMatch(/thử lại/);
  });
});
