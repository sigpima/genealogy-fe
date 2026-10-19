import { describe, expect, it } from 'vitest';
import { SECTIONS, visibleSections } from './sections';

describe('admin sections', () => {
  it('lists the settings-type areas only: work pages (log, data entry, publishing) live in the left menu', () => {
    expect(visibleSections().map((s) => s.id)).toEqual(['users', 'settings', 'privacy', 'shares', 'health']);
  });
  it('has unique addresses, all under /admin', () => {
    const hrefs = SECTIONS.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(SECTIONS.every((s) => s.href.startsWith('/admin/'))).toBe(true);
  });
  it('gives every section a label and a hint to show on its tile', () => {
    for (const s of SECTIONS) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.hint.length).toBeGreaterThan(5);
    }
  });
  it('says nothing about signing up (there is no public sign-up any more)', () => {
    for (const s of SECTIONS) expect(`${s.label} ${s.hint}`).not.toMatch(/đăng ký/i);
  });
  it('names the link page for what it holds: the calendar link and the invitation cards', () => {
    expect(SECTIONS.find((s) => s.id === 'shares')?.label).toBe('Link lịch & thiệp mời');
  });
});
