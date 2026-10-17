import { generationCounts } from './generations';
import type { FamilyMember } from './types';

export function collapsedIdsForDepth(root: FamilyMember, depth: number): Set<number> {
  const collapsed = new Set<number>();
  function walk(node: FamilyMember, generation: number) {
    if (generation === depth && node.id !== undefined && (node.children?.length ?? 0) > 0) {
      collapsed.add(node.id);
      return;
    }
    if (generation > depth) return;
    node.children?.forEach((child) => walk(child, generation + 1));
  }
  walk(root, 1);
  return collapsed;
}

function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

export function expandedDepthOf(root: FamilyMember, collapsedIds: Set<number>): number | null {
  const deepest = generationCounts(root).length;
  for (let depth = 1; depth <= deepest; depth++) {
    if (sameSet(collapsedIds, collapsedIdsForDepth(root, depth))) return depth;
  }
  return null;
}

export function expandPathTo(root: FamilyMember, collapsedIds: Set<number>, targetId: number): Set<number> {
  const next = new Set(collapsedIds);
  function walk(node: FamilyMember, ancestors: number[]): boolean {
    if (node.id === targetId) {
      ancestors.forEach((id) => next.delete(id));
      return true;
    }
    const nextAncestors = node.id === undefined ? ancestors : [...ancestors, node.id];
    return (node.children ?? []).some((child) => walk(child, nextAncestors));
  }
  walk(root, []);
  return next;
}
