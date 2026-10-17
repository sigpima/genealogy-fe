import { describe, expect, it } from 'vitest';
import { DETAIL_FETCH_CONCURRENCY, pickIdsToFetch } from './detail-queue';

const candidates = [
  { id: 1, x: 500, y: 0 },
  { id: 2, x: 10, y: 0 },
  { id: 3, x: 100, y: 0 },
  { id: 4, x: 300, y: 0 },
];
const center = { x: 0, y: 0 };

describe('pickIdsToFetch', () => {
  it('returns the nearest candidates first', () => {
    expect(pickIdsToFetch(candidates, center, new Set(), 0)).toEqual([2, 3, 4, 1]);
  });
  it('skips ids already requested, including failed ones', () => {
    expect(pickIdsToFetch(candidates, center, new Set([2, 4]), 0)).toEqual([3, 1]);
  });
  it('returns nothing when the concurrency budget is used up', () => {
    expect(pickIdsToFetch(candidates, center, new Set(), DETAIL_FETCH_CONCURRENCY)).toEqual([]);
  });
  it('only fills the remaining concurrency budget', () => {
    expect(pickIdsToFetch(candidates, center, new Set(), DETAIL_FETCH_CONCURRENCY - 2)).toEqual([2, 3]);
  });
  it('never returns a negative-sized batch when over budget', () => {
    expect(pickIdsToFetch(candidates, center, new Set(), 99)).toEqual([]);
  });
  it('handles no candidates', () => {
    expect(pickIdsToFetch([], center, new Set(), 0)).toEqual([]);
  });
});
