import { describe, expect, it } from 'vitest';
import { SECTIONS, visibleSections } from './sections';

describe('admin sections', () => {
  it('shows only the sections whose pages exist, in the planned order', () => {
    expect(visibleSections().map((s) => s.id)).toEqual(['users', 'settings', 'privacy', 'audit', 'shares', 'health', 'publish']);
  });
  it('has unique addresses and only the publish section lives outside /admin', () => {
    const hrefs = SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(SECTIONS.filter((s) => !s.href.startsWith('/admin/')).map((s) => s.id)).toEqual(['publish']);
  });
  it('gives every section a label and a hint to show on its tile', () => {
    for (const s of SECTIONS) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.hint.length).toBeGreaterThan(5);
    }
  });
});
