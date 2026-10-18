import { describe, expect, it } from 'vitest';
import { PLATFORM_SECTIONS, visiblePlatformSections } from './sections';

describe('platform sections', () => {
  it('shows only the sections whose pages exist', () => {
    expect(visiblePlatformSections().map((s) => s.id)).toEqual(['trees']);
  });
  it('has unique addresses, all under /he-thong', () => {
    const hrefs = PLATFORM_SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h.startsWith('/he-thong/'))).toBe(true);
  });
  it('gives every section a label and a hint for its tile', () => {
    for (const s of PLATFORM_SECTIONS) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.hint.length).toBeGreaterThan(5);
    }
  });
});
