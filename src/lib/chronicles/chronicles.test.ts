import { describe, expect, it } from 'vitest';
import {
  articlePayload,
  century,
  EMPTY_ARTICLE_FORM,
  EMPTY_TIMELINE_FORM,
  formatTimelineDate,
  timelinePayload,
  wordHint,
  wordsPayload,
  wordsToRows,
} from './chronicles';

describe('timeline helpers', () => {
  it('formats partial dates', () => {
    expect(formatTimelineDate({ year: 1820, month: null, day: null })).toBe('1820');
    expect(formatTimelineDate({ year: 1820, month: 3, day: null })).toBe('03/1820');
    expect(formatTimelineDate({ year: 1820, month: 3, day: 5 })).toBe('05/03/1820');
  });
  it('names centuries', () => {
    expect(century(1820)).toBe('Thế kỷ XIX');
    expect(century(1900)).toBe('Thế kỷ XIX');
    expect(century(1901)).toBe('Thế kỷ XX');
    expect(century(1427)).toBe('Thế kỷ XV');
  });
  it('validates the form like the API', () => {
    expect(timelinePayload(EMPTY_TIMELINE_FORM)).toMatchObject({ ok: false });
    const ok = { ...EMPTY_TIMELINE_FORM, year: '1950', title: ' Xây nhà thờ ' };
    expect(timelinePayload(ok)).toEqual({ ok: true, payload: { year: 1950, month: null, day: null, title: 'Xây nhà thờ', body: null, member_id: null } });
    expect(timelinePayload({ ...ok, day: '5' })).toMatchObject({ ok: false, error: expect.stringContaining('tháng') });
    expect(timelinePayload({ ...ok, month: '2', day: '30' })).toMatchObject({ ok: false });
    expect(timelinePayload({ ...ok, month: '13' })).toMatchObject({ ok: false });
    expect(timelinePayload({ ...ok, year: '0' })).toMatchObject({ ok: false });
    expect(timelinePayload({ ...ok, month: '2', day: '29', year: '2000' })).toMatchObject({ ok: true });
  });
});

describe('generation words', () => {
  const words = [{ generation: 5, word: 'Văn', meaning: 'văn hay' }, { generation: 6, word: 'Đức', meaning: null }];
  it('hints the word of a generation', () => {
    expect(wordHint(words, 5)).toBe('Chữ đệm đời 5: Văn (văn hay)');
    expect(wordHint(words, 6)).toBe('Chữ đệm đời 6: Đức');
    expect(wordHint(words, 7)).toBeNull();
  });
  it('round-trips rows, skipping blanks and sorting', () => {
    const rows = [...wordsToRows(words).reverse(), { generation: '', word: '', meaning: '' }];
    expect(wordsPayload(rows)).toEqual({ ok: true, payload: { words } });
  });
  it('rejects duplicates, missing words and bad generations', () => {
    expect(wordsPayload([{ generation: '1', word: 'A', meaning: '' }, { generation: '1', word: 'B', meaning: '' }])).toMatchObject({ ok: false });
    expect(wordsPayload([{ generation: '1', word: ' ', meaning: '' }])).toMatchObject({ ok: false });
    expect(wordsPayload([{ generation: 'x', word: 'A', meaning: '' }])).toMatchObject({ ok: false });
    expect(wordsPayload([{ generation: '201', word: 'A', meaning: '' }])).toMatchObject({ ok: false });
  });
});

describe('articlePayload', () => {
  it('needs a title and trims it, deduplicating the mentioned people', () => {
    expect(articlePayload(EMPTY_ARTICLE_FORM)).toMatchObject({ ok: false });
    const result = articlePayload({ ...EMPTY_ARTICLE_FORM, title: '  Tộc ước ', member_ids: [1, 2, 2] });
    expect(result).toMatchObject({ ok: true, payload: { title: 'Tộc ước', member_ids: [1, 2] } });
    expect(articlePayload({ ...EMPTY_ARTICLE_FORM, title: 'x', body: 'a'.repeat(100_001) })).toMatchObject({ ok: false });
  });
});
