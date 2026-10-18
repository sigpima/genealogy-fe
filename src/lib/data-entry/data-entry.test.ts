import { describe, expect, it } from 'vitest';
import { importErrorsFrom, summaryText } from './import';
import { parseCell, patchErrorMessage } from './cells';
import { parseSplitNames, splitError, suggestSplitNames } from './split';
import { buildTableQuery, EMPTY_FILTERS, hasActiveFilters, pageRange, toggleMissing } from './table';

describe('buildTableQuery', () => {
  it('always pages, and only sends the filters that are set', () => {
    expect(buildTableQuery(EMPTY_FILTERS, 0)).toBe('limit=100&offset=0');
    const q = buildTableQuery({ q: ' Nguyễn ', generation: 3, under: 7, missing: ['gender', 'birth_year'] }, 200);
    const params = new URLSearchParams(q);
    expect(params.get('q')).toBe('Nguyễn');
    expect(params.get('generation')).toBe('3');
    expect(params.get('under')).toBe('7');
    expect(params.getAll('missing')).toEqual(['gender', 'birth_year']);
    expect(params.get('offset')).toBe('200');
  });
  it('detects active filters and toggles chips', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, under: 1 })).toBe(true);
    expect(toggleMissing(['gender'], 'hometown')).toEqual(['gender', 'hometown']);
    expect(toggleMissing(['gender', 'hometown'], 'gender')).toEqual(['hometown']);
  });
  it('computes range labels', () => {
    expect(pageRange(250, 100, 100)).toBe('101–200 / 250');
    expect(pageRange(0, 0, 0)).toBe('0');
  });
});

describe('parseCell', () => {
  it('turns blanks into null, but never for a required name', () => {
    expect(parseCell('text', '  ')).toEqual({ ok: true, value: null });
    expect(parseCell('requiredText', ' ')).toMatchObject({ ok: false });
    expect(parseCell('requiredText', ' An ')).toEqual({ ok: true, value: 'An' });
  });
  it('validates years, orders and genders', () => {
    expect(parseCell('year', '1945')).toEqual({ ok: true, value: 1945 });
    expect(parseCell('year', '19x')).toMatchObject({ ok: false });
    expect(parseCell('year', '0')).toMatchObject({ ok: false });
    expect(parseCell('order', '2')).toEqual({ ok: true, value: 2 });
    expect(parseCell('order', '0')).toMatchObject({ ok: false });
    expect(parseCell('gender', 'female')).toEqual({ ok: true, value: 'female' });
    expect(parseCell('gender', 'robot')).toMatchObject({ ok: false });
    expect(parseCell('gender', '')).toEqual({ ok: true, value: null });
  });
  it('explains refused saves', () => {
    expect(patchErrorMessage(422)).toMatch(/hợp lệ/);
    expect(patchErrorMessage(500)).toMatch(/thử lại/);
  });
});

describe('split helpers', () => {
  it('parses names from lines, commas and semicolons', () => {
    expect(parseSplitNames('A\n B, C;;\n')).toEqual(['A', 'B', 'C']);
    expect(splitError(['A'])).toMatch(/ít nhất/);
    expect(splitError(['A', 'B'])).toBeNull();
    expect(splitError(Array.from({ length: 51 }, (_, i) => String(i)))).toMatch(/Tối đa/);
  });
  it('suggests numbered names from "... N Vị"', () => {
    expect(suggestSplitNames('Nguyễn Vô Danh 3 Vị')).toBe('Nguyễn Vô Danh 1\nNguyễn Vô Danh 2\nNguyễn Vô Danh 3');
    expect(suggestSplitNames('Nguyễn Văn A')).toBe('');
    expect(suggestSplitNames('Vô Danh 1')).toBe('');
  });
});

describe('importErrorsFrom', () => {
  it('reads per-row errors of a rejected file', () => {
    const body = { detail: { message: 'x', errors: [{ row: 3, message: 'bad' }] } };
    expect(importErrorsFrom(422, body)).toEqual({ general: null, rows: [{ row: 3, message: 'bad' }] });
  });
  it('falls back to a general message', () => {
    expect(importErrorsFrom(413, { detail: 'too large' }).general).toMatch(/quá lớn/);
    expect(importErrorsFrom(400, { detail: 'the file must be UTF-8' }).general).toMatch(/UTF-8/);
    expect(importErrorsFrom(500, null).general).toMatch(/Không thể/);
  });
  it('summarises counts', () => {
    expect(summaryText({ created: 1, updated: 2, unchanged: 3 })).toBe('2 cập nhật · 1 thêm mới · 3 không đổi');
  });
});

import { filtersFromAddress } from './table';
import { MISSING_FIELDS } from './types';

describe('filtersFromAddress', () => {
  it('reads the missing chips and the generation, ignoring unknown values', () => {
    expect(filtersFromAddress('?missing=gender,avatar,shoe&generation=3', MISSING_FIELDS)).toEqual({
      q: '',
      generation: 3,
      under: null,
      missing: ['gender', 'avatar'],
    });
    expect(filtersFromAddress('?missing=avatar,avatar&generation=x', MISSING_FIELDS)).toMatchObject({ missing: ['avatar'], generation: null });
    expect(filtersFromAddress('', MISSING_FIELDS)).toEqual({ q: '', generation: null, under: null, missing: [] });
  });
});
