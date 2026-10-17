import { describe, expect, it } from 'vitest';
import { formatPartialDate, hasDayOrMonth, maxDayFor } from './dates';

const date = (over: Partial<Parameters<typeof formatPartialDate>[0]>) => ({
  year: null,
  month: null,
  day: null,
  isLunar: false,
  leapMonth: false,
  ...over,
});

describe('formatPartialDate', () => {
  it('returns null when nothing is known', () => {
    expect(formatPartialDate(date({}))).toBeNull();
  });
  it('shows a bare year without a calendar suffix, even for a lunar default', () => {
    expect(formatPartialDate(date({ year: 1945 }))).toBe('1945');
    expect(formatPartialDate(date({ year: 1945, isLunar: true }))).toBe('1945');
  });
  it('shows a full solar date', () => {
    expect(formatPartialDate(date({ year: 1945, month: 8, day: 15 }))).toBe('15/08/1945');
  });
  it('shows month+year and day+month', () => {
    expect(formatPartialDate(date({ year: 1945, month: 8 }))).toBe('08/1945');
    expect(formatPartialDate(date({ month: 8, day: 15 }))).toBe('15/08');
  });
  it('marks lunar dates, with the leap month', () => {
    expect(formatPartialDate(date({ month: 3, day: 12, isLunar: true }))).toBe('12/03 âm lịch');
    expect(formatPartialDate(date({ year: 2020, month: 3, day: 12, isLunar: true, leapMonth: true }))).toBe(
      '12/03/2020 âm lịch (tháng nhuận)'
    );
  });
});

describe('hasDayOrMonth', () => {
  it('is false for a bare year only', () => {
    expect(hasDayOrMonth({ month: null, day: null })).toBe(false);
    expect(hasDayOrMonth({ month: 2, day: null })).toBe(true);
  });
});

describe('maxDayFor', () => {
  it('allows 30 days in any lunar month and 31 when the month is unknown', () => {
    expect(maxDayFor(2, true, null)).toBe(30);
    expect(maxDayFor(null, false, 2001)).toBe(31);
  });
  it('knows solar month lengths and leap years', () => {
    expect(maxDayFor(4, false, null)).toBe(30);
    expect(maxDayFor(2, false, 2001)).toBe(28);
    expect(maxDayFor(2, false, 2000)).toBe(29);
    expect(maxDayFor(2, false, 1900)).toBe(28);
    expect(maxDayFor(2, false, null)).toBe(29);
  });
});
