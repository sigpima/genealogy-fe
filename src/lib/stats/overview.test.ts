import { describe, expect, it } from 'vitest';
import { completenessLink, formatNumber, percentOf, searchLinks, widths } from './overview';

describe('overview helpers', () => {
  it('computes percentages and formats numbers', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBe(0);
    expect(formatNumber(72.5)).toBe('72,5');
    expect(formatNumber(null)).toBe('–');
    expect(formatNumber(66)).toBe('66');
  });
  it('builds search links for the bars', () => {
    expect(searchLinks.generation(3)).toBe('/tim-kiem?generation=3');
    expect(searchLinks.gender('female')).toBe('/tim-kiem?gender=female');
    expect(searchLinks.status('living')).toBe('/tim-kiem?status=living');
    expect(searchLinks.decade(1950)).toBe('/tim-kiem?born_from=1950&born_to=1959');
    expect(searchLinks.branch(4)).toBe('/tim-kiem?branch=4');
  });
  it('links completeness rows to the data-entry grid when it can filter on them', () => {
    expect(completenessLink('avatar')).toBe('/nhap-lieu?missing=avatar');
    expect(completenessLink('birth_year')).toBe('/nhap-lieu?missing=birth_year');
    expect(completenessLink('photos')).toBeNull();
  });
  it('scales bars to the largest, keeping tiny ones visible', () => {
    expect(widths([2, 4, 1])).toEqual([50, 100, 25]);
    expect(widths([1000, 1, 0])).toEqual([100, 2, 0]);
    expect(widths([])).toEqual([]);
  });
});
