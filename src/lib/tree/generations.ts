import type { FamilyMember } from './types';


export type GenerationTier = 'ancestor' | 'mid' | 'descendant';

export function generationCounts(root: FamilyMember): number[] {
  const counts: number[] = [];
  let level: FamilyMember[] = [root];
  while (level.length > 0) {
    counts.push(level.length);
    level = level.flatMap((member) => member.children ?? []);
  }
  return counts;
}

export function totalMembers(root: FamilyMember): number {
  return generationCounts(root).reduce((sum, count) => sum + count, 0);
}

export function descendantCount(node: FamilyMember): number {
  return totalMembers(node) - 1;
}

const ROMAN_NUMERALS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(n: number): string {
  let remaining = n;
  let result = '';
  for (const [value, symbol] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

export function generationTier(generation: number): GenerationTier {
  if (generation <= 2) return 'ancestor';
  if (generation <= 5) return 'mid';
  return 'descendant';
}
