import { describe, expect, it } from 'vitest';
import {
  EMPTY_EVENT_FORM,
  eventPayload,
  eventToForm,
  feedUrl,
  formatDayMonth,
  isoDate,
  lunarLabel,
  monthGrid,
  parseDayParam,
  relativeDays,
  reminderLabel,
  shiftMonth,
  type CalendarDay,
  type CalendarItem,
} from './calendar';

function days(year: number, month: number, count: number): CalendarDay[] {
  return Array.from({ length: count }, (_, i) => ({
    date: isoDate(year, month, i + 1),
    lunar_day: (i % 30) + 1,
    lunar_month: month,
    lunar_year: year,
    lunar_leap: false,
  }));
}

describe('monthGrid', () => {
  it('starts weeks on Monday and pads with blanks', () => {
    // 1 September 2024 was a Sunday: six blanks, then the 1st in the last column of week 1
    const grid = monthGrid(days(2024, 9, 30), []);
    expect(grid[0].slice(0, 6).every((c) => c.day === null)).toBe(true);
    expect(grid[0][6].day?.date).toBe('2024-09-01');
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid.flat().filter((c) => c.day).length).toBe(30);
    expect(grid.length).toBe(6);
  });
  it('puts items on their day', () => {
    const item = { date: '2024-09-17', title: 'Giỗ' } as CalendarItem;
    const cell = monthGrid(days(2024, 9, 30), [item]).flat().find((c) => c.day?.date === '2024-09-17');
    expect(cell?.items).toEqual([item]);
  });
  it('handles an empty month and one that starts on Monday', () => {
    expect(monthGrid([], [])).toEqual([]);
    const grid = monthGrid(days(2024, 1, 31), []); // 1 January 2024 was a Monday
    expect(grid[0][0].day?.date).toBe('2024-01-01');
  });
});

describe('labels and dates', () => {
  it('shows the lunar day, and d/m on the first of a lunar month', () => {
    const base = { date: 'x', lunar_day: 15, lunar_month: 8, lunar_year: 2024, lunar_leap: false };
    expect(lunarLabel(base)).toBe('15');
    expect(lunarLabel({ ...base, lunar_day: 1 })).toBe('1/8');
    expect(lunarLabel({ ...base, lunar_day: 1, lunar_leap: true })).toBe('1/8n');
  });
  it('moves between months across years', () => {
    expect(shiftMonth(2024, 12, 1)).toEqual({ year: 2025, month: 1 });
    expect(shiftMonth(2024, 1, -1)).toEqual({ year: 2023, month: 12 });
    expect(shiftMonth(2024, 6, 0)).toEqual({ year: 2024, month: 6 });
    expect(shiftMonth(2024, 1, -13)).toEqual({ year: 2022, month: 12 });
  });
  it('says how far away a day is', () => {
    expect(relativeDays('2024-09-10', '2024-09-10')).toBe('hôm nay');
    expect(relativeDays('2024-09-11', '2024-09-10')).toBe('ngày mai');
    expect(relativeDays('2024-09-17', '2024-09-10')).toBe('7 ngày nữa');
    expect(relativeDays('2024-09-08', '2024-09-10')).toBe('2 ngày trước');
  });
  it('formats and parses', () => {
    expect(formatDayMonth('2024-09-07')).toBe('07/09');
    expect(parseDayParam('?ngay=2024-09-17')).toEqual({ year: 2024, month: 9, date: '2024-09-17' });
    expect(parseDayParam('?ngay=2024-13-01')).toBeNull();
    expect(parseDayParam('?ngay=abc')).toBeNull();
    expect(parseDayParam('')).toBeNull();
    expect(feedUrl('http://x:3000', '/calendar/feed/t.ics')).toBe('http://x:3000/api/calendar/feed/t.ics');
    expect(reminderLabel(0)).toBe('Đúng ngày');
    expect(reminderLabel(1)).toBe('Trước 1 ngày');
    expect(reminderLabel(7)).toBe('Trước 7 ngày');
  });
});

describe('eventPayload', () => {
  const ok = { ...EMPTY_EVENT_FORM, title: ' Giỗ Tổ ', month: '3', day: '10' };
  it('builds a request body, trimming and nulling blanks', () => {
    expect(eventPayload({ ...ok, location: ' Nhà thờ ' })).toEqual({
      ok: true,
      payload: {
        title: 'Giỗ Tổ',
        kind: 'gathering',
        calendar: 'lunar',
        year: null,
        month: 3,
        day: 10,
        repeats_yearly: true,
        time_text: null,
        location: 'Nhà thờ',
        description: null,
      },
    });
  });
  it('rejects what the API would reject', () => {
    expect(eventPayload({ ...ok, title: ' ' })).toMatchObject({ ok: false });
    expect(eventPayload({ ...ok, month: '13' })).toMatchObject({ ok: false });
    expect(eventPayload({ ...ok, day: '31' })).toMatchObject({ ok: false }); // lunar months have at most 30 days
    expect(eventPayload({ ...ok, calendar: 'solar', day: '31' })).toMatchObject({ ok: true });
    expect(eventPayload({ ...ok, calendar: 'solar', month: '2', day: '30' })).toMatchObject({ ok: false });
    expect(eventPayload({ ...ok, calendar: 'solar', month: '2', day: '29', year: '2023', repeats_yearly: false })).toMatchObject({ ok: false });
    expect(eventPayload({ ...ok, repeats_yearly: false })).toMatchObject({ ok: false, error: expect.stringContaining('cần có năm') });
    expect(eventPayload({ ...ok, repeats_yearly: false, year: '2030' })).toMatchObject({ ok: true });
    expect(eventPayload({ ...ok, time_text: '8:30' })).toMatchObject({ ok: false });
    expect(eventPayload({ ...ok, time_text: '08:30' })).toMatchObject({ ok: true });
    expect(eventPayload({ ...ok, year: '1800' })).toMatchObject({ ok: false });
  });
  it('round-trips an event through the form', () => {
    const event = { id: 1, title: 'Họp', kind: 'wedding' as const, calendar: 'solar' as const, year: 2030, month: 6, day: 15, repeats_yearly: false, time_text: '08:30', location: 'Nhà', description: null };
    const result = eventPayload(eventToForm(event));
    expect(result).toEqual({ ok: true, payload: Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'id')) });
  });
});
