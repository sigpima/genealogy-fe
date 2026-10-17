import { describe, expect, it } from 'vitest';
import { TREE_SLUG_COOKIE, isValidTreeSlug, signupTreeNotice } from './tree';

describe('isValidTreeSlug', () => {
  it('accepts lowercase letters, digits and single hyphens', () => {
    for (const slug of ['phu-oc', 'ho-nguyen-2', 'a', 'default', '123'])
      expect(isValidTreeSlug(slug)).toBe(true);
  });
  it('rejects anything that could be abused in a cookie or URL', () => {
    for (const slug of [
      '',
      'Phu-Oc',
      'phu oc',
      '-phu',
      'phu-',
      'phu--oc',
      'phú-ốc',
      'a;b',
      'a/b',
      '../x',
      'a'.repeat(61),
    ]) {
      expect(isValidTreeSlug(slug)).toBe(false);
    }
  });
});

describe('TREE_SLUG_COOKIE', () => {
  it('matches the cookie the API reads', () => {
    expect(TREE_SLUG_COOKIE).toBe('tree_slug');
  });
});

describe('signupTreeNotice', () => {
  it('names the family the visitor is joining', () => {
    expect(signupTreeNotice({ status: 'ok', treeName: 'Họ Nguyễn' })).toBe(
      'Bạn đang đăng ký vào gia phả: Họ Nguyễn.',
    );
  });
  it('asks for the family link when several families exist and none was chosen', () => {
    expect(signupTreeNotice({ status: 'unknown', treeName: null })).toMatch(
      /liên kết/,
    );
  });
  it('says nothing while loading or without a tree name', () => {
    expect(signupTreeNotice({ status: 'loading', treeName: null })).toBeNull();
    expect(signupTreeNotice({ status: 'ok', treeName: null })).toBeNull();
  });
});
