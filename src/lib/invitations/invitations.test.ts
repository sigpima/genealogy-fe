import { describe, expect, it } from 'vitest';
import { answerPayload, countsLine, fullLink, longDate, lunarLine, parseNames, storageKey, totalsLine } from './invitations';

describe('presentation', () => {
  it('writes the date with its weekday and the lunar date', () => {
    expect(longDate('2025-04-07')).toBe('Thứ hai, 07/04/2025');
    expect(longDate('2024-09-17')).toBe('Thứ ba, 17/09/2024');
    expect(lunarLine({ day: 10, month: 3, year: 2025, leap: false })).toBe('Tức ngày 10 tháng 3 năm 2025 âm lịch');
    expect(lunarLine({ day: 1, month: 4, year: 2020, leap: true })).toContain('(nhuận)');
  });
  it('summarises totals for guests and admins', () => {
    expect(totalsLine({ yes: 0, people: 0 })).toMatch(/đầu tiên/);
    expect(totalsLine({ yes: 3, people: 8 })).toBe('Đã có 3 lượt xác nhận, tổng 8 người tham dự');
    expect(countsLine({ yes: 3, no: 1, maybe: 2, pending: 4, people: 8 })).toBe('3 tham dự (8 người) · 1 không · 2 chưa chắc · 4 chưa trả lời');
  });
  it('keys the saved answer by the open token and builds full links', () => {
    expect(storageKey('abc')).toBe('gia-pha:thiep:abc');
    expect(fullLink('http://x:3000', '/thiep/t')).toBe('http://x:3000/thiep/t');
  });
});

describe('answerPayload', () => {
  const base = { name: ' Nguyễn Văn Hai ', response: 'yes' as const, partySize: '3', note: ' Về từ Hà Nội ' };
  it('builds the request, naming the guest only on the open link', () => {
    expect(answerPayload(base, true)).toEqual({ ok: true, body: { name: 'Nguyễn Văn Hai', response: 'yes', party_size: 3, note: 'Về từ Hà Nội' } });
    expect(answerPayload(base, false)).toEqual({ ok: true, body: { response: 'yes', party_size: 3, note: 'Về từ Hà Nội' } });
  });
  it('does not send a party size for a "no" or "maybe"', () => {
    expect(answerPayload({ ...base, response: 'no', partySize: 'abc', note: '' }, false)).toEqual({ ok: true, body: { response: 'no', note: null } });
  });
  it('rejects what the API would reject', () => {
    expect(answerPayload({ ...base, name: ' ' }, true)).toMatchObject({ ok: false });
    expect(answerPayload({ ...base, response: '' }, true)).toMatchObject({ ok: false });
    expect(answerPayload({ ...base, partySize: '0' }, true)).toMatchObject({ ok: false });
    expect(answerPayload({ ...base, partySize: '21' }, true)).toMatchObject({ ok: false });
    expect(answerPayload({ ...base, note: 'x'.repeat(501) }, true)).toMatchObject({ ok: false });
  });
});

describe('parseNames', () => {
  it('splits lines, commas and semicolons, dropping blanks and repeats', () => {
    expect(parseNames('Ông Hai\n Bà Ba, Ông Hai;;\n')).toEqual(['Ông Hai', 'Bà Ba']);
    expect(parseNames('  ')).toEqual([]);
  });
});
