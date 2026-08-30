import { hierarchy, tree as d3tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { FamilyMember } from './types';

export type TreeNodeSize = { x: number; y: number };
export type TreeSeparation = { siblings: number; nonSiblings: number };
export type TreeLink = { source: HierarchyPointNode<FamilyMember>; target: HierarchyPointNode<FamilyMember> };
export type TreeLayout = { nodes: HierarchyPointNode<FamilyMember>[]; links: TreeLink[] };

export function computeLayout(
  root: FamilyMember,
  collapsedIds: Set<number>,
  nodeSize: TreeNodeSize,
  separation: TreeSeparation
): TreeLayout {
  const layoutTree = d3tree<FamilyMember>()
    .nodeSize([nodeSize.x, nodeSize.y])
    .separation((a, b) => (a.parent === b.parent ? separation.siblings : separation.nonSiblings));
  const rootNode = layoutTree(
    hierarchy(root, (d) => (d.id !== undefined && collapsedIds.has(d.id) ? null : d.children))
  );
  return { nodes: rootNode.descendants(), links: rootNode.links() };
}

export function stepPath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  const deltaY = target.y - source.y;
  return `M${source.x},${source.y} V${source.y + deltaY / 2} H${target.x} V${target.y}`;
}
