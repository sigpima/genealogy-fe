import { describe, expect, it } from 'vitest';
import { idsNeedingDetail } from './detail-cache';
import type { MemberDetail } from './types';

function detailFor(id: number): MemberDetail {
  return {
    id,
    birth_year: null,
    death_year: null,
    gender: null,
    notes: null,
    avatar_url: null,
    courtesy_name: null,
    title: null,
    residence: null,
    burial_place: null,
    burial_latitude: null,
    burial_longitude: null,
    sibling_rank: null,
    spouses: [],
  };
}

describe('idsNeedingDetail', () => {
  it('returns ids in the set that are not yet cached', () => {
    const cache = new Map([[1, detailFor(1)]]);
    expect(idsNeedingDetail(new Set([1, 2, 3]), cache)).toEqual([2, 3]);
  });

  it('returns an empty array when everything is already cached', () => {
    const cache = new Map([[1, detailFor(1)], [2, detailFor(2)]]);
    expect(idsNeedingDetail(new Set([1, 2]), cache)).toEqual([]);
  });

  it('returns every id when the cache is empty', () => {
    expect(idsNeedingDetail(new Set([5, 6]), new Map())).toEqual([5, 6]);
  });
});
