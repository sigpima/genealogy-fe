import { describe, expect, it } from 'vitest';
import { assignBranches, branchErrorMessage, isHexColor, sortBranches, type Branch } from './branches';
import type { FamilyMember } from '@/lib/tree/types';

const branch = (id: number, head: number, generation: number): Branch => ({
  id,
  name: `Chi ${id}`,
  color: '#112233',
  description: null,
  root_member_id: head,
  root_name: `Head ${head}`,
  root_generation: generation,
  member_count: 1,
});

// 1 -> [2 -> [4 -> 5, 6], 3 -> 7]
const tree: FamilyMember = {
  id: 1,
  name: 'Tổ',
  children: [
    { id: 2, name: 'Chi một', children: [{ id: 4, name: 'a', children: [{ id: 5, name: 'a1' }] }, { id: 6, name: 'b' }] },
    { id: 3, name: 'Chi hai', children: [{ id: 7, name: 'c' }] },
  ],
};

describe('assignBranches', () => {
  it('gives each member the branch of the nearest head above (or at) them', () => {
    const map = assignBranches(tree, [branch(10, 2, 2), branch(20, 4, 3)]);
    expect(map.get(1)).toBeUndefined();
    expect(map.get(2)?.id).toBe(10);
    expect(map.get(6)?.id).toBe(10);
    expect(map.get(4)?.id).toBe(20); // a sub-branch overrides the outer one
    expect(map.get(5)?.id).toBe(20);
    expect(map.get(3)).toBeUndefined();
    expect(map.get(7)).toBeUndefined();
  });
  it('is empty without branches', () => {
    expect(assignBranches(tree, []).size).toBe(0);
  });
  it('ignores a head that is not in the tree', () => {
    expect(assignBranches(tree, [branch(1, 999, 2)]).size).toBe(0);
  });
});

describe('sortBranches', () => {
  it('orders by head generation, then id', () => {
    const sorted = sortBranches([branch(3, 1, 3), branch(2, 1, 2), branch(1, 1, 3)]);
    expect(sorted.map((b) => b.id)).toEqual([2, 1, 3]);
  });
});

describe('helpers', () => {
  it('validates #rrggbb colours', () => {
    expect(isHexColor('#2e7d32')).toBe(true);
    expect(isHexColor('2e7d32')).toBe(false);
    expect(isHexColor('#fff')).toBe(false);
  });
  it('explains refusals', () => {
    expect(branchErrorMessage(409, 'x')).toMatch(/trưởng/);
    expect(branchErrorMessage(422, undefined)).toMatch(/chưa hợp lệ/);
    expect(branchErrorMessage(500, null)).toMatch(/thử lại/);
  });
});
