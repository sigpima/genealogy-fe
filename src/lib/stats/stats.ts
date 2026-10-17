import type { BranchRef } from '@/lib/branches/branches';

export type Stats = {
  total: number;
  spouses: number;
  by_generation: { generation: number; count: number }[];
  gender: { male: number; female: number; other: number; unknown: number };
  status: { living: number; deceased: number; unknown: number };
  by_branch: (BranchRef & { count: number })[];
  without_branch: number;
};

/** Bar widths in whole percent, the largest value being 100 (a bar chart needs no axis for a handful of rows). */
export function barPercents(values: number[]): number[] {
  const max = Math.max(0, ...values);
  if (max === 0) return values.map(() => 0);
  return values.map((value) => Math.max(value > 0 ? 2 : 0, Math.round((value / max) * 100)));
}

/** "34%" of the total, or "–" when there is nothing to divide. */
export function shareLabel(part: number, total: number): string {
  if (total <= 0) return '–';
  return `${Math.round((part / total) * 100)}%`;
}
