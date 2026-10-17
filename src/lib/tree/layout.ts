import { hierarchy, tree as d3tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { FamilyMember } from './types';

export type TreeNodeSize = { x: number; y: number };
export type TreeSeparation = { siblings: number; nonSiblings: number };
export type TreeLink = { source: HierarchyPointNode<FamilyMember>; target: HierarchyPointNode<FamilyMember> };
export type TreeLayout = { nodes: HierarchyPointNode<FamilyMember>[]; links: TreeLink[] };
export type Orientation = 'vertical' | 'horizontal';

/**
 * `nodeSize` is always (lateral, depth): the distance between siblings and between generations. Vertical puts
 * generations in rows (x = lateral); horizontal turns the whole picture a quarter: generations are columns (x = depth).
 */
export function slotSize(nodeSize: TreeNodeSize, orientation: Orientation): TreeNodeSize {
  return orientation === 'horizontal' ? { x: nodeSize.y, y: nodeSize.x } : nodeSize;
}

export function computeLayout(
  root: FamilyMember,
  collapsedIds: Set<number>,
  nodeSize: TreeNodeSize,
  separation: TreeSeparation,
  orientation: Orientation = 'vertical'
): TreeLayout {
  const layoutTree = d3tree<FamilyMember>()
    .nodeSize([nodeSize.x, nodeSize.y])
    .separation((a, b) => (a.parent === b.parent ? separation.siblings : separation.nonSiblings));
  const rootNode = layoutTree(
    hierarchy(root, (d) => (d.id !== undefined && collapsedIds.has(d.id) ? null : d.children))
  );
  const nodes = rootNode.descendants();
  if (orientation === 'horizontal') {
    for (const node of nodes) [node.x, node.y] = [node.y, node.x]; // links hold these same objects
  }
  return { nodes, links: rootNode.links() };
}

export function stepPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  orientation: Orientation = 'vertical'
): string {
  if (orientation === 'horizontal') {
    const deltaX = target.x - source.x;
    return `M${source.x},${source.y} H${source.x + deltaX / 2} V${target.y} H${target.x}`;
  }
  const deltaY = target.y - source.y;
  return `M${source.x},${source.y} V${source.y + deltaY / 2} H${target.x} V${target.y}`;
}
