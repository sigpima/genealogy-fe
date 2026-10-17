import { describe, expect, it } from 'vitest';
import {
  buildSearchQuery,
  EMPTY_FILTERS,
  filterProblem,
  focusHref,
  filtersFromSearch,
  focusIdFor,
  hasCriteria,
  itemSubtitle,
  pageLabel,
  parseFocusParam,
  type SearchItem,
} from './search';

const item = (over: Partial<SearchItem> = {}): SearchItem => ({
  id: 5,
  full_name: 'Nguyễn Văn Hòa',
  generation: 3,
  gender: 'male',
  birth_year: 1930,
  death_year: 2001,
  hometown: 'Hà Tĩnh',
  parent_name: 'Nguyễn Văn Tổ',
  branch: null,
  is_spouse: false,
  spouse_of: null,
  ...over,
});

describe('buildSearchQuery', () => {
  it('sends only what is filled in, trimmed, and always pages', () => {
    expect(buildSearchQuery(EMPTY_FILTERS, 0)).toBe('limit=30&offset=0');
    const q = new URLSearchParams(
      buildSearchQuery(
        { ...EMPTY_FILTERS, q: ' hoa ', generation: '3', bornFrom: '1900', gender: 'female', status: 'living', hometown: 'Huế', branch: '4', bornTo: '1950' },
        60,
      ),
    );
    expect(Object.fromEntries(q)).toEqual({
      q: 'hoa',
      generation: '3',
      branch: '4',
      born_from: '1900',
      born_to: '1950',
      hometown: 'Huế',
      gender: 'female',
      status: 'living',
      limit: '30',
      offset: '60',
    });
  });
});

describe('criteria and problems', () => {
  it('knows when nothing is set', () => {
    expect(hasCriteria(EMPTY_FILTERS)).toBe(false);
    expect(hasCriteria({ ...EMPTY_FILTERS, hometown: ' x ' })).toBe(true);
    expect(hasCriteria({ ...EMPTY_FILTERS, hometown: '   ' })).toBe(false);
  });
  it('flags non-numeric and reversed ranges', () => {
    expect(filterProblem(EMPTY_FILTERS)).toBeNull();
    expect(filterProblem({ ...EMPTY_FILTERS, generation: 'abc' })).toMatch(/Đời/);
    expect(filterProblem({ ...EMPTY_FILTERS, bornFrom: '1950', bornTo: '1900' })).toMatch(/nhỏ hơn/);
    expect(filterProblem({ ...EMPTY_FILTERS, bornFrom: '1900', bornTo: '1950' })).toBeNull();
  });
});

describe('result presentation', () => {
  it('describes a person on one line', () => {
    expect(itemSubtitle(item())).toBe('Đời 3 · 1930 – 2001 · Hà Tĩnh · con Nguyễn Văn Tổ');
    expect(itemSubtitle(item({ birth_year: null, death_year: 1999, hometown: null, parent_name: null }))).toBe('Đời 3 · ? – 1999');
  });
  it('names the partner of a spouse and leads to them', () => {
    const spouse = item({ id: 9, is_spouse: true, spouse_of: { id: 5, name: 'Nguyễn Văn Hòa' }, parent_name: null });
    expect(itemSubtitle(spouse)).toContain('vợ/chồng của Nguyễn Văn Hòa');
    expect(focusIdFor(spouse)).toBe(5);
    expect(focusIdFor(item())).toBe(5);
  });
  it('builds and reads the focus link', () => {
    expect(focusHref(12)).toBe('/?focus=12');
    expect(parseFocusParam('?focus=12')).toBe(12);
    expect(parseFocusParam('?focus=abc')).toBeNull();
    expect(parseFocusParam('')).toBeNull();
  });
  it('labels the page range', () => {
    expect(pageLabel(70, 30, 30)).toBe('31–60 / 70 kết quả');
    expect(pageLabel(0, 0, 0)).toBe('0 kết quả');
  });
});

describe('filtersFromSearch', () => {
  it('reads known filters from the address and ignores junk', () => {
    expect(filtersFromSearch('?generation=3&gender=female&status=living&born_from=1950&born_to=1959&branch=4&hometown=Huế&q=hoa')).toEqual({
      q: 'hoa',
      generation: '3',
      branch: '4',
      bornFrom: '1950',
      bornTo: '1959',
      hometown: 'Huế',
      gender: 'female',
      status: 'living',
    });
    expect(filtersFromSearch('?gender=robot&status=zombie&generation=abc&branch=x&born_from=19500')).toEqual(EMPTY_FILTERS);
    expect(filtersFromSearch('')).toEqual(EMPTY_FILTERS);
  });
});
