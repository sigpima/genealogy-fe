import { describe, expect, it } from 'vitest';
import {
  descendantCount,
  generationCounts,
  generationTier,
  toRoman,
  totalMembers,
} from './generations';
import type { FamilyMember } from './types';

// 1 -> {2, 3}, 2 -> {4}, 4 -> {5}: generations 1..4 have 1, 2, 1, 1 members.
const fixture: FamilyMember = {
  id: 1,
  name: 'n1',
  children: [
    { id: 2, name: 'n2', children: [{ id: 4, name: 'n4', children: [{ id: 5, name: 'n5' }] }] },
    { id: 3, name: 'n3' },
  ],
};

describe('generationCounts', () => {
  it('counts members per generation, index 0 being Đời 1', () => {
    expect(generationCounts(fixture)).toEqual([1, 2, 1, 1]);
  });
  it('returns a single entry for a single member', () => {
    expect(generationCounts({ id: 1, name: 'solo' })).toEqual([1]);
  });
});

describe('totalMembers / descendantCount', () => {
  it('counts every member', () => {
    expect(totalMembers(fixture)).toBe(5);
  });
  it('counts descendants excluding the node itself', () => {
    expect(descendantCount(fixture)).toBe(4);
  });
  it('is zero for a leaf', () => {
    expect(descendantCount({ id: 3, name: 'n3' })).toBe(0);
  });
});

describe('toRoman', () => {
  it('converts generation numbers', () => {
    expect([1, 4, 9, 14, 40].map(toRoman)).toEqual(['I', 'IV', 'IX', 'XIV', 'XL']);
  });
});

describe('generationTier', () => {
  it('maps generations to the design tiers', () => {
    expect(generationTier(1)).toBe('ancestor');
    expect(generationTier(2)).toBe('ancestor');
    expect(generationTier(3)).toBe('mid');
    expect(generationTier(5)).toBe('mid');
    expect(generationTier(6)).toBe('descendant');
  });
});
