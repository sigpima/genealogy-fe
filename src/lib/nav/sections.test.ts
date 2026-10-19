import { describe, expect, it } from 'vitest';
import { navSections } from './sections';

const item = (id: string, group: 'user' | 'admin' | 'platform', show = true) => ({ id, group, show });

describe('navSections', () => {
  it('groups the menu as everyone, then admin, then platform, in order', () => {
    const sections = navSections([item('a', 'user'), item('b', 'user'), item('c', 'admin'), item('d', 'platform')]);
    expect(sections.map((s) => s.map((e) => e.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });
  it('leaves out hidden items and groups that end up empty (no stray divider)', () => {
    const sections = navSections([item('a', 'user'), item('c', 'admin', false), item('d', 'platform')]);
    expect(sections.map((s) => s.map((e) => e.id))).toEqual([['a'], ['d']]);
  });
  it('keeps the order inside a group as given', () => {
    const sections = navSections([item('b', 'admin'), item('a', 'user'), item('c', 'admin')]);
    expect(sections.map((s) => s.map((e) => e.id))).toEqual([['a'], ['b', 'c']]);
  });
  it('is empty when nothing is shown', () => {
    expect(navSections([item('a', 'user', false)])).toEqual([]);
  });
});
