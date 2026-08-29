import { describe, expect, it } from 'vitest';
import { findMembersByName, findPathToMember, generationOf, getMemberAtPath } from './search';
import type { FamilyMember } from './types';

const tree: FamilyMember = {
  name: 'nguyễn đại lan',
  children: [
    {
      name: 'nguyễn văn mít',
      children: [{ name: 'nguyễn văn lãng' }, { name: 'nguyễn văn an' }],
    },
  ],
};

describe('findMembersByName', () => {
  it('finds a case-insensitive substring match and returns its ancestor path', () => {
    const matches = findMembersByName(tree, 'LÃNG');
    expect(matches).toHaveLength(1);
    expect(matches[0].path).toEqual(['nguyễn đại lan', 'nguyễn văn mít', 'nguyễn văn lãng']);
  });

  it('returns multiple matches when the query matches more than one member', () => {
    const matches = findMembersByName(tree, 'văn');
    expect(matches.map((m) => m.member.name)).toEqual([
      'nguyễn văn mít',
      'nguyễn văn lãng',
      'nguyễn văn an',
    ]);
  });

  it('returns an empty array for a blank query', () => {
    expect(findMembersByName(tree, '   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(findMembersByName(tree, 'không tồn tại')).toEqual([]);
  });
});

describe('findPathToMember', () => {
  it('finds the path to a specific member object by reference', () => {
    const target = tree.children![0].children![1];
    expect(findPathToMember(tree, target)).toEqual([
      'nguyễn đại lan',
      'nguyễn văn mít',
      'nguyễn văn an',
    ]);
  });

  it('returns null when the member is not in the tree', () => {
    expect(findPathToMember(tree, { name: 'ai đó' })).toBeNull();
  });
});

describe('generationOf', () => {
  it('returns the 1-indexed generation number from a path', () => {
    expect(generationOf(['a', 'b', 'c'])).toBe(3);
    expect(generationOf(['a'])).toBe(1);
  });
});

describe('getMemberAtPath', () => {
  it('walks the tree by name path and returns the member at the end', () => {
    const member = getMemberAtPath(tree, ['nguyễn đại lan', 'nguyễn văn mít', 'nguyễn văn lãng']);
    expect(member?.name).toBe('nguyễn văn lãng');
  });

  it('returns null when the path does not match the tree', () => {
    expect(getMemberAtPath(tree, ['nguyễn đại lan', 'không tồn tại'])).toBeNull();
  });

  it('returns null when the path does not start at the root', () => {
    expect(getMemberAtPath(tree, ['nguyễn văn mít'])).toBeNull();
  });
});
