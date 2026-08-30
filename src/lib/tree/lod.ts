import type { FamilyMember } from './types';

function buildAdjacency(root: FamilyMember): Map<number, number[]> {
  const adjacency = new Map<number, number[]>();

  function ensure(id: number): number[] {
    let neighbors = adjacency.get(id);
    if (!neighbors) {
      neighbors = [];
      adjacency.set(id, neighbors);
    }
    return neighbors;
  }

  function walk(node: FamilyMember, parentId: number | null) {
    if (node.id === undefined) return;
    ensure(node.id);
    if (parentId !== null) {
      ensure(parentId).push(node.id);
      ensure(node.id).push(parentId);
    }
    node.children?.forEach((child) => walk(child, node.id ?? null));
  }

  walk(root, null);
  return adjacency;
}

export function computeDetailSet(
  root: FamilyMember,
  focalId: number,
  radius = 3
): Set<number> {
  const adjacency = buildAdjacency(root);
  const startId = adjacency.has(focalId) ? focalId : root.id;
  const detailed = new Set<number>();
  if (startId === undefined) return detailed;

  detailed.add(startId);
  let frontier = [startId];
  for (let hop = 0; hop < radius; hop++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!detailed.has(neighbor)) {
          detailed.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return detailed;
}
