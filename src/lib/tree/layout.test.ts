import { describe, expect, it } from 'vitest';
import { computeLayout, slotSize, stepPath } from './layout';
import type { FamilyMember } from './types';

const nodeSize = { x: 100, y: 50 };
const separation = { siblings: 1, nonSiblings: 2 };

const tree: FamilyMember = {
  id: 1,
  name: 'root',
  children: [
    { id: 2, name: 'a', children: [{ id: 4, name: 'a1' }] },
    { id: 3, name: 'b' },
  ],
};

describe('computeLayout', () => {
  it('includes every node when nothing is collapsed, with depth-based y', () => {
    const { nodes } = computeLayout(tree, new Set(), nodeSize, separation);
    expect(nodes.map((n) => n.data.id).sort()).toEqual([1, 2, 3, 4]);
    const byId = new Map(nodes.map((n) => [n.data.id, n]));
    expect(byId.get(1)!.y).toBe(0);
    expect(byId.get(2)!.y).toBe(nodeSize.y);
    expect(byId.get(3)!.y).toBe(nodeSize.y);
    expect(byId.get(4)!.y).toBe(nodeSize.y * 2);
  });

  it('spreads siblings apart with the parent centered between them', () => {
    const { nodes } = computeLayout(tree, new Set(), nodeSize, separation);
    const byId = new Map(nodes.map((n) => [n.data.id, n]));
    const a = byId.get(2)!;
    const b = byId.get(3)!;
    const root = byId.get(1)!;
    expect(a.x).not.toBe(b.x);
    expect(root.x).toBeCloseTo((a.x + b.x) / 2, 5);
  });

  it("excludes a collapsed node's descendants from both nodes and links", () => {
    const { nodes, links } = computeLayout(tree, new Set([2]), nodeSize, separation);
    expect(nodes.map((n) => n.data.id).sort()).toEqual([1, 2, 3]);
    expect(links.some((l) => l.target.data.id === 4)).toBe(false);
  });

  it('produces one link per edge', () => {
    const { links } = computeLayout(tree, new Set(), nodeSize, separation);
    expect(links).toHaveLength(3);
  });
});

describe('stepPath', () => {
  it('matches the exact right-angle formula', () => {
    expect(stepPath({ x: 0, y: 0 }, { x: 100, y: 50 })).toBe('M0,0 V25 H100 V50');
  });
});

describe('horizontal orientation', () => {
  const tree: FamilyMember = { id: 1, name: 'Tổ', children: [{ id: 2, name: 'An' }, { id: 3, name: 'Bình' }] };
  const size = { x: 100, y: 300 }; // (lateral, depth)
  const separation = { siblings: 1, nonSiblings: 1 };

  it('puts generations in columns and siblings in rows', () => {
    const { nodes } = computeLayout(tree, new Set(), size, separation, 'horizontal');
    const byId = new Map(nodes.map((n) => [n.data.id, n]));
    expect(byId.get(1)!.x).toBe(0);
    expect(byId.get(2)!.x).toBe(300);
    expect(byId.get(3)!.x).toBe(300);
    expect(Math.abs(byId.get(2)!.y - byId.get(3)!.y)).toBe(100);
  });
  it('keeps the vertical layout as it was', () => {
    const { nodes } = computeLayout(tree, new Set(), size, separation);
    const byId = new Map(nodes.map((n) => [n.data.id, n]));
    expect(byId.get(2)!.y).toBe(300);
    expect(Math.abs(byId.get(2)!.x - byId.get(3)!.x)).toBe(100);
  });
  it('turns link paths and slot sizes with the tree', () => {
    expect(stepPath({ x: 0, y: 0 }, { x: 300, y: 50 }, 'horizontal')).toBe('M0,0 H150 V50 H300');
    expect(slotSize(size, 'horizontal')).toEqual({ x: 300, y: 100 });
    expect(slotSize(size, 'vertical')).toEqual(size);
  });
});
