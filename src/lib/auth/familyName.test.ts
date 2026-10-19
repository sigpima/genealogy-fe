import { describe, expect, it } from 'vitest';
import { familyNameFor } from './familyName';

describe('familyNameFor', () => {
  it('is the family a signed-in family member belongs to', () => {
    expect(familyNameFor({ role: 'admin', tree_name: 'Họ Nguyễn' }, null, null)).toBe('Họ Nguyễn');
    expect(familyNameFor({ role: 'member', tree_name: 'Họ Trần' }, [], 'Khác')).toBe('Họ Trần');
  });
  it('is the family the superadmin is acting in (the one marked current)', () => {
    const trees = [
      { name: 'Họ A', is_current: false },
      { name: 'Họ B', is_current: true },
    ];
    expect(familyNameFor({ role: 'superadmin', tree_name: null }, trees, null)).toBe('Họ B');
  });
  it('falls back to the first family for a superadmin when none is marked, and to nothing when there is none', () => {
    expect(familyNameFor({ role: 'superadmin', tree_name: null }, [{ name: 'Họ A', is_current: false }], null)).toBe('Họ A');
    expect(familyNameFor({ role: 'superadmin', tree_name: null }, [], null)).toBeNull();
    expect(familyNameFor({ role: 'superadmin', tree_name: null }, null, null)).toBeNull();
  });
  it('is the family the site shows a guest', () => {
    expect(familyNameFor(null, null, 'Họ Lê')).toBe('Họ Lê');
    expect(familyNameFor(null, null, null)).toBeNull();
  });
});
