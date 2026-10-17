import type { BranchRef } from '@/lib/branches/branches';

export type Overview = {
  totals: { members: number; spouses: number; generations: number; living: number; deceased: number; unknown: number };
  gender: { male: number; female: number; other: number; unknown: number };
  by_generation: { generation: number; count: number; male: number; female: number }[];
  by_branch: (BranchRef & { count: number })[];
  without_branch: number;
  lifespan: {
    count: number;
    average: number | null;
    median: number | null;
    shortest: number | null;
    longest: number | null;
    male_average: number | null;
    female_average: number | null;
  };
  birth_decades: { decade: number; count: number }[];
  children: { parents: number; average_per_parent: number | null; childless: number; most: { id: number; name: string; count: number } | null };
  longest_line: { generations: number; names: string[] };
  middle_names: { word: string; count: number }[];
  given_names: { word: string; count: number }[];
  completeness: { field: string; label: string; have: number; total: number }[];
};

/** Whole-number percentage, 0 for an empty total. */
export function percentOf(have: number, total: number): number {
  return total <= 0 ? 0 : Math.round((have / total) * 100);
}

/** "72,5" — a decimal comma, and a dash for "no data". */
export function formatNumber(value: number | null): string {
  return value === null ? '–' : String(value).replace('.', ',');
}

/** Where a click on a bar goes: the search page, pre-filtered (it reads these parameters from the address). */
export const searchLinks = {
  generation: (generation: number) => `/tim-kiem?generation=${generation}`,
  gender: (gender: 'male' | 'female' | 'other' | 'unknown') => `/tim-kiem?gender=${gender}`,
  status: (status: 'living' | 'deceased' | 'unknown') => `/tim-kiem?status=${status}`,
  decade: (decade: number) => `/tim-kiem?born_from=${decade}&born_to=${decade + 9}`,
  branch: (id: number) => `/tim-kiem?branch=${id}`,
};

/** Fields the data-entry grid can filter "missing" on; the other completeness rows have no such filter yet. */
const GRID_FILTERS: Record<string, string> = { gender: 'gender', birth_year: 'birth_year', hometown: 'hometown', avatar: 'avatar' };

export function completenessLink(field: string): string | null {
  return GRID_FILTERS[field] ? `/nhap-lieu?missing=${GRID_FILTERS[field]}` : null;
}

/** Bar widths in whole percent against the largest value (never 0 for a non-zero value, so a tiny bar stays visible). */
export function widths(values: number[]): number[] {
  const max = Math.max(0, ...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => (v > 0 ? Math.max(2, Math.round((v / max) * 100)) : 0));
}
