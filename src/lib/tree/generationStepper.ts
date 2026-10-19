import type { FamilyMember } from './types';

/** The tree (and a branch) first opens on this many generations; the stepper shows more or fewer. */
export const DEFAULT_GENERATIONS = 4;

/** Reads what the user typed into the depth box: anything unusable falls back to `max`, the rest is kept inside [min, max]. */
export function clampDepth(raw: string | number, min: number, max: number): number {
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim() === '' ? NaN : raw);
  if (!Number.isFinite(parsed)) return max;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

/** How many generations a tree (or branch) first opens on: four, or all of them when it is shorter. */
export function defaultDepth(max: number): number {
  return Math.min(max, DEFAULT_GENERATIONS);
}

/** The deepest (absolute) generation that is on screen below `root`, given which people are collapsed. */
export function deepestShownGeneration(root: FamilyMember, collapsedIds: Set<number>, rootGeneration: number): number {
  let deepest = rootGeneration;
  const stack: [FamilyMember, number][] = [[root, rootGeneration]];
  while (stack.length > 0) {
    const [node, generation] = stack.pop()!;
    deepest = Math.max(deepest, generation);
    if (node.id !== undefined && collapsedIds.has(node.id)) continue;
    for (const child of node.children ?? []) stack.push([child, generation + 1]);
  }
  return deepest;
}

/** How many generations lie in the subtree, `root` included. */
export function subtreeDepth(root: FamilyMember): number {
  let depth = 0;
  let level: FamilyMember[] = [root];
  while (level.length > 0) {
    depth += 1;
    level = level.flatMap((member) => member.children ?? []);
  }
  return depth;
}

export function idsInSubtree(root: FamilyMember): Set<number> {
  const ids = new Set<number>();
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id !== undefined) ids.add(node.id);
    stack.push(...(node.children ?? []));
  }
  return ids;
}
