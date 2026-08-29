import type { FamilyMember } from './types';

export type SearchMatch = {
  member: FamilyMember;
  path: string[];
};

export function findMembersByName(root: FamilyMember, query: string): SearchMatch[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const matches: SearchMatch[] = [];

  function walk(node: FamilyMember, path: string[]) {
    const nextPath = [...path, node.name];
    if (normalize(node.name).includes(normalizedQuery)) {
      matches.push({ member: node, path: nextPath });
    }
    node.children?.forEach((child) => walk(child, nextPath));
  }

  walk(root, []);
  return matches;
}

export function findPathToMember(root: FamilyMember, target: FamilyMember): string[] | null {
  function walk(node: FamilyMember, path: string[]): string[] | null {
    const nextPath = [...path, node.name];
    if (node === target) return nextPath;
    for (const child of node.children ?? []) {
      const found = walk(child, nextPath);
      if (found) return found;
    }
    return null;
  }
  return walk(root, []);
}

export function generationOf(path: string[]): number {
  return path.length;
}

export function getMemberAtPath(root: FamilyMember, path: string[]): FamilyMember | null {
  if (path.length === 0 || path[0] !== root.name) return null;
  let current = root;
  for (const segment of path.slice(1)) {
    const next = current.children?.find((child) => child.name === segment);
    if (!next) return null;
    current = next;
  }
  return current;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export type ReparentCandidate = { id: number; name: string };

export function getReparentCandidates(root: FamilyMember, memberId: number): ReparentCandidate[] {
  const excluded = new Set<number>([memberId]);

  function collectDescendants(node: FamilyMember) {
    (node.children ?? []).forEach((child) => {
      if (child.id !== undefined) excluded.add(child.id);
      collectDescendants(child);
    });
  }

  function findAndCollect(node: FamilyMember): boolean {
    if (node.id === memberId) {
      collectDescendants(node);
      return true;
    }
    return (node.children ?? []).some(findAndCollect);
  }

  findAndCollect(root);

  const candidates: ReparentCandidate[] = [];
  function walk(node: FamilyMember) {
    if (node.id !== undefined && !excluded.has(node.id)) {
      candidates.push({ id: node.id, name: node.name });
    }
    node.children?.forEach(walk);
  }
  walk(root);
  return candidates;
}
