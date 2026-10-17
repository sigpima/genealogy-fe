import { describe, expect, it } from 'vitest';
import { generationCounts, totalMembers } from './generations';
import { generateSyntheticTree } from './synthetic';
import type { FamilyMember } from './types';

function collectIds(node: FamilyMember, ids: number[] = []): number[] {
  if (node.id !== undefined) ids.push(node.id);
  node.children?.forEach((child) => collectIds(child, ids));
  return ids;
}

describe('generateSyntheticTree', () => {
  it('produces exactly the requested number of members', () => {
    expect(totalMembers(generateSyntheticTree(2000))).toBe(2000);
  });
  it('is deterministic for a given seed', () => {
    expect(generateSyntheticTree(300, 7)).toEqual(generateSyntheticTree(300, 7));
  });
  it('uses unique ids with the root being 1', () => {
    const tree = generateSyntheticTree(500);
    const ids = collectIds(tree);
    expect(tree.id).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('is deep enough to exercise several generations', () => {
    expect(generationCounts(generateSyntheticTree(2000)).length).toBeGreaterThanOrEqual(6);
  });
  it('can be a single member', () => {
    const tree = generateSyntheticTree(1);
    expect(tree.children ?? []).toEqual([]);
  });
});
