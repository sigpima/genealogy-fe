import { describe, expect, it } from 'vitest';
import { collapsedIdsForDepth, expandPathTo, expandedDepthOf } from './expansion';
import type { FamilyMember } from './types';

const fixture: FamilyMember = {
  id: 1,
  name: 'n1',
  children: [
    { id: 2, name: 'n2', children: [{ id: 4, name: 'n4', children: [{ id: 5, name: 'n5' }] }] },
    { id: 3, name: 'n3' },
  ],
};

describe('collapsedIdsForDepth', () => {
  it('collapses members at the given generation that have children', () => {
    expect(collapsedIdsForDepth(fixture, 2)).toEqual(new Set([2]));
    expect(collapsedIdsForDepth(fixture, 1)).toEqual(new Set([1]));
  });
  it('collapses nothing when the depth exceeds the tree', () => {
    expect(collapsedIdsForDepth(fixture, 9)).toEqual(new Set());
  });
});

describe('expandedDepthOf', () => {
  it('recognises the set produced by collapsedIdsForDepth', () => {
    expect(expandedDepthOf(fixture, collapsedIdsForDepth(fixture, 2))).toBe(2);
  });
  it('reports the deepest generation when nothing is collapsed', () => {
    expect(expandedDepthOf(fixture, new Set())).toBe(4);
  });
  it('returns null for an uneven manual state', () => {
    expect(expandedDepthOf(fixture, new Set([5]))).toBeNull();
  });
});

describe('expandPathTo', () => {
  it('removes every strict ancestor of the target', () => {
    expect(expandPathTo(fixture, new Set([1, 2, 4]), 5)).toEqual(new Set());
    expect(expandPathTo(fixture, new Set([1, 2]), 3)).toEqual(new Set([2]));
  });
  it('returns an equal but distinct copy for an unknown target', () => {
    const input = new Set([1, 2]);
    const result = expandPathTo(fixture, input, 999);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});
