import { describe, expect, it } from 'vitest';
import {
  findAncestorChainById,
  findMembersByName,
  findPathToMember,
  generationOf,
  getMemberAtPath,
  getReparentCandidates,
} from './search';
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

  it('ignores diacritics: typing without tone marks still finds the member', () => {
    expect(findMembersByName(tree, 'lang').map((m) => m.member.name)).toEqual(['nguyễn văn lãng']);
    expect(findMembersByName(tree, 'dai LAN').map((m) => m.member.name)).toEqual(['nguyễn đại lan']);
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

describe('getReparentCandidates', () => {
  const idTree: FamilyMember = {
    id: 1,
    name: 'Root',
    children: [
      {
        id: 2,
        name: 'Child A',
        children: [{ id: 4, name: 'Grandchild A1' }, { id: 5, name: 'Grandchild A2' }],
      },
      { id: 3, name: 'Child B' },
    ],
  };

  it('excludes the member itself and its own descendants', () => {
    const candidates = getReparentCandidates(idTree, 2);
    expect(candidates.map((c) => c.id).sort()).toEqual([1, 3]);
  });

  it('returns an empty list for the root, since its descendants are the whole tree', () => {
    expect(getReparentCandidates(idTree, 1)).toEqual([]);
  });

  it('includes every non-descendant blood-line member for a leaf', () => {
    const candidates = getReparentCandidates(idTree, 4);
    expect(candidates.map((c) => c.id).sort()).toEqual([1, 2, 3, 5]);
  });
});

describe('findAncestorChainById', () => {
  const duplicateNameTree: FamilyMember = {
    id: 1,
    name: 'root',
    children: [
      {
        id: 2,
        name: 'dup',
        children: [{ id: 4, name: 'dup' }],
      },
      { id: 3, name: 'other' },
    ],
  };

  it('returns the root-to-target chain of member objects', () => {
    const chain = findAncestorChainById(duplicateNameTree, 4);
    expect(chain?.map((m) => m.id)).toEqual([1, 2, 4]);
  });

  it('returns null for a nonexistent id', () => {
    expect(findAncestorChainById(duplicateNameTree, 999)).toBeNull();
  });

  it('disambiguates same-named members by id', () => {
    const chain = findAncestorChainById(duplicateNameTree, 2);
    expect(chain?.map((m) => m.id)).toEqual([1, 2]);
  });
});
