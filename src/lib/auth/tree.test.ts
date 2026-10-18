import { describe, expect, it } from 'vitest';
import { TREE_SLUG_COOKIE, isValidTreeSlug } from './tree';

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
