import { describe, expect, it } from 'vitest';
import { DEMO_TREE_SLUG, TREE_SLUG_COOKIE, isDemoTree, isValidTreeSlug, treeSlugSetCookie } from './tree';

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

describe('isDemoTree', () => {
  it('is true only for the demo family slug', () => {
    expect(DEMO_TREE_SLUG).toBe('demo');
    expect(isDemoTree('demo')).toBe(true);
    for (const slug of ['phu-oc', 'Demo', 'demo-2', 'my-demo', '', null, undefined]) expect(isDemoTree(slug)).toBe(false);
  });
});

describe('treeSlugSetCookie', () => {
  it('builds the Set-Cookie value the /t and /guest routes send', () => {
    expect(treeSlugSetCookie('demo')).toBe('tree_slug=demo; Path=/; Max-Age=31536000; SameSite=Lax');
  });
});
