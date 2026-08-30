import { describe, expect, it } from 'vitest';
import { computeDetailSet } from './lod';
import type { FamilyMember } from './types';

// Chain 1-2-3-4-5-6-7-8 with an extra branch 9-10-11 hanging off node 3
// (sibling of node 4), so the fixture covers both ancestor/descendant
// hops from an interior focal node and a lateral (cousin-direction) hop.
const tree: FamilyMember = {
  id: 1,
  name: 'n1',
  children: [
    {
      id: 2,
      name: 'n2',
      children: [
        {
          id: 3,
          name: 'n3',
          children: [
            {
              id: 4,
              name: 'n4',
              children: [
                {
                  id: 5,
                  name: 'n5',
                  children: [
                    {
                      id: 6,
                      name: 'n6',
                      children: [
                        {
                          id: 7,
                          name: 'n7',
                          children: [{ id: 8, name: 'n8' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 9,
              name: 'n9',
              children: [{ id: 10, name: 'n10', children: [{ id: 11, name: 'n11' }] }],
            },
          ],
        },
      ],
    },
  ],
};

describe('computeDetailSet', () => {
  it('includes the focal node and everyone within radius hops in both directions', () => {
    const detailed = computeDetailSet(tree, 5, 3);
    expect([...detailed].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('excludes nodes exactly one hop past the radius', () => {
    const detailed = computeDetailSet(tree, 5, 3);
    expect(detailed.has(1)).toBe(false);
    expect(detailed.has(10)).toBe(false);
    expect(detailed.has(11)).toBe(false);
  });

  it('defaults to a radius of 3 when none is given', () => {
    const detailed = computeDetailSet(tree, 5);
    expect([...detailed].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('falls back to the tree root when focalId is not present in the tree', () => {
    const detailed = computeDetailSet(tree, 999, 3);
    expect([...detailed].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 9]);
  });
});
