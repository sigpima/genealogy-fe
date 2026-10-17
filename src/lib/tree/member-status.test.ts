import { describe, expect, it } from 'vitest';
import { lifespanLabel, memberStatus } from './member-status';

const NOW = 2026;

describe('memberStatus', () => {
  it('is living with a birth year within 100 years and no death year', () => {
    expect(memberStatus(1945, null, NOW)).toBe('living');
    expect(memberStatus(1926, null, NOW)).toBe('living');
  });
  it('is unknown with an older birth year and no death year', () => {
    expect(memberStatus(1925, null, NOW)).toBe('unknown');
    expect(memberStatus(1850, null, NOW)).toBe('unknown');
  });
  it('is unknown with no years at all', () => {
    expect(memberStatus(null, null, NOW)).toBe('unknown');
  });
  it('is deceased whenever a death year exists', () => {
    expect(memberStatus(1918, 1989, NOW)).toBe('deceased');
    expect(memberStatus(null, 1989, NOW)).toBe('deceased');
  });
});

describe('lifespanLabel', () => {
  it('shows "nay" only for living members', () => {
    expect(lifespanLabel(1945, null, NOW)).toBe('1945 – nay');
  });
  it('shows both years for deceased members', () => {
    expect(lifespanLabel(1918, 1989, NOW)).toBe('1918 – 1989');
  });
  it('shows a question mark for unknown death years', () => {
    expect(lifespanLabel(1850, null, NOW)).toBe('1850 – ?');
  });
  it('shows a question mark for unknown birth years', () => {
    expect(lifespanLabel(null, 1989, NOW)).toBe('? – 1989');
  });
  it('is null with no years', () => {
    expect(lifespanLabel(null, null, NOW)).toBeNull();
  });
});
