import { describe, expect, it } from 'vitest';
import {
  clampDepth,
  deepestShownGeneration,
  defaultDepth,
  idsInSubtree,
  subtreeDepth,
} from './generationStepper';
import type { FamilyMember } from './types';

const tree: FamilyMember = {
  id: 1,
  name: 'Tổ',
  children: [
    { id: 2, name: 'A', children: [{ id: 4, name: 'A1', children: [{ id: 6, name: 'A11' }] }] },
    { id: 3, name: 'B' },
  ],
};

describe('clampDepth', () => {
  it('falls back to max for empty or non numeric text', () => {
    expect(clampDepth('', 1, 8)).toBe(8);
    expect(clampDepth('abc', 1, 8)).toBe(8);
  });
  it('keeps the number inside the range', () => {
    expect(clampDepth('0', 1, 8)).toBe(1);
    expect(clampDepth('99', 1, 8)).toBe(8);
    expect(clampDepth(5, 3, 8)).toBe(5);
    expect(clampDepth(2, 3, 8)).toBe(3);
  });
  it('drops decimals', () => {
    expect(clampDepth('3.7', 1, 8)).toBe(3);
  });
  it('works when the range is a single generation', () => {
    expect(clampDepth('4', 4, 4)).toBe(4);
    expect(clampDepth('1', 4, 4)).toBe(4);
  });
});

describe('defaultDepth', () => {
  it('opens on the first four generations, as the tree always did', () => {
    expect(defaultDepth(8)).toBe(4);
    expect(defaultDepth(4)).toBe(4);
  });
  it('shows everything when the tree is shorter than that', () => {
    expect(defaultDepth(3)).toBe(3);
    expect(defaultDepth(1)).toBe(1);
  });
});

describe('deepestShownGeneration', () => {
  it('is the youngest generation when nothing is collapsed', () => {
    expect(deepestShownGeneration(tree, new Set(), 1)).toBe(4);
  });
  it('stops at a collapsed person (who is still shown)', () => {
    expect(deepestShownGeneration(tree, new Set([2]), 1)).toBe(2);
    expect(deepestShownGeneration(tree, new Set([4]), 1)).toBe(3);
  });
  it('counts from the generation of the shown root in a branch view', () => {
    const branch = tree.children![0];
    expect(deepestShownGeneration(branch, new Set(), 2)).toBe(4);
  });
});

describe('subtree helpers', () => {
  it('measures a subtree and lists its ids', () => {
    expect(subtreeDepth(tree)).toBe(4);
    expect(subtreeDepth(tree.children![1])).toBe(1);
    expect([...idsInSubtree(tree.children![0])].sort()).toEqual([2, 4, 6]);
  });
});
