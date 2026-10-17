import { describe, expect, it } from 'vitest';
import { barPercents, shareLabel } from './stats';

describe('barPercents', () => {
  it('scales to the largest value', () => {
    expect(barPercents([2, 4, 1])).toEqual([50, 100, 25]);
  });
  it('keeps a tiny non-zero value visible and a zero empty', () => {
    expect(barPercents([1000, 1, 0])).toEqual([100, 2, 0]);
  });
  it('is all zero for nothing', () => {
    expect(barPercents([])).toEqual([]);
    expect(barPercents([0, 0])).toEqual([0, 0]);
  });
});

describe('shareLabel', () => {
  it('rounds to a whole percent and survives an empty total', () => {
    expect(shareLabel(1, 3)).toBe('33%');
    expect(shareLabel(0, 0)).toBe('–');
  });
});
