import { describe, expect, it } from 'vitest';
import { actingTreeCookie, familyLink, isValidSlug, slugify, treeErrorMessage } from './trees';

describe('slugify', () => {
  it('drops Vietnamese diacritics, including đ', () => {
    expect(slugify('Nguyễn Tộc Làng Phú Ốc')).toBe('nguyen-toc-lang-phu-oc');
    expect(slugify('Đặng Đình')).toBe('dang-dinh');
  });
  it('collapses punctuation and trims hyphens', () => {
    expect(slugify('  Họ  Trần -- (chi 2)! ')).toBe('ho-tran-chi-2');
    expect(slugify('***')).toBe('');
  });
  it('always yields a valid slug of at most 60 characters', () => {
    const slug = slugify('a '.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(isValidSlug(slug)).toBe(true);
  });
});

describe('isValidSlug', () => {
  it('mirrors the API rule', () => {
    expect(isValidSlug('phu-oc')).toBe(true);
    expect(isValidSlug('Phu-Oc')).toBe(false);
    expect(isValidSlug('phu--oc')).toBe(false);
    expect(isValidSlug('-phu')).toBe(false);
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('a'.repeat(61))).toBe(false);
  });
});

describe('actingTreeCookie / familyLink', () => {
  it('builds a site-wide, long-lived Lax cookie', () => {
    expect(actingTreeCookie(7)).toBe('acting_tree=7; Path=/; Max-Age=31536000; SameSite=Lax');
  });
  it('builds the family link', () => {
    expect(familyLink('http://x:3000', 'phu-oc')).toBe('http://x:3000/t/phu-oc');
  });
});

describe('treeErrorMessage', () => {
  it('explains the common refusals', () => {
    expect(treeErrorMessage(409, 'slug already in use')).toMatch(/slug/);
    expect(treeErrorMessage(409, 'email already registered')).toMatch(/Email/);
    expect(treeErrorMessage(422, undefined)).toMatch(/chưa hợp lệ/);
    expect(treeErrorMessage(403, 'superadmin only')).toMatch(/tối cao/);
    expect(treeErrorMessage(500, null)).toMatch(/thử lại/);
  });
});
