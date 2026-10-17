import type { BranchRef } from '@/lib/branches/branches';

export type SearchGender = 'male' | 'female' | 'other' | 'unknown';
export type SearchStatus = 'living' | 'deceased' | 'unknown';

/** One row of `GET /api/members/search`. */
export type SearchItem = {
  id: number;
  full_name: string;
  generation: number;
  gender: 'male' | 'female' | 'other' | null;
  birth_year: number | null;
  death_year: number | null;
  hometown: string | null;
  parent_name: string | null;
  branch: BranchRef | null;
  is_spouse: boolean;
  /** For a spouse: the blood member they married (the tree shows that person). */
  spouse_of: { id: number; name: string } | null;
};

export type SearchPage = { total: number; items: SearchItem[]; suggestions: SearchItem[] };

export type SearchFilters = {
  q: string;
  generation: string;
  branch: string;
  bornFrom: string;
  bornTo: string;
  hometown: string;
  gender: '' | SearchGender;
  status: '' | SearchStatus;
};

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  generation: '',
  branch: '',
  bornFrom: '',
  bornTo: '',
  hometown: '',
  gender: '',
  status: '',
};

export const PAGE_SIZE = 30;

/** Query string for `GET /api/members/search`; blank fields are left out. */
export function buildSearchQuery(filters: SearchFilters, offset: number, limit: number = PAGE_SIZE): string {
  const params = new URLSearchParams();
  const put = (key: string, value: string) => {
    if (value.trim()) params.set(key, value.trim());
  };
  put('q', filters.q);
  put('generation', filters.generation);
  put('branch', filters.branch);
  put('born_from', filters.bornFrom);
  put('born_to', filters.bornTo);
  put('hometown', filters.hometown);
  put('gender', filters.gender);
  put('status', filters.status);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return params.toString();
}

/** True when at least one criterion is set (an empty search would just list everybody). */
export function hasCriteria(filters: SearchFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== '');
}

/** Whether the numeric fields are usable; returns the first problem to show, or null. */
export function filterProblem(filters: SearchFilters): string | null {
  const numbers: [string, string][] = [
    [filters.generation, 'Đời'],
    [filters.bornFrom, 'Năm sinh từ'],
    [filters.bornTo, 'Năm sinh đến'],
  ];
  for (const [value, label] of numbers) {
    if (value.trim() && !/^\d{1,4}$/.test(value.trim())) return `${label} phải là một số.`;
  }
  if (filters.bornFrom.trim() && filters.bornTo.trim() && Number(filters.bornFrom) > Number(filters.bornTo)) {
    return 'Năm sinh "từ" phải nhỏ hơn hoặc bằng "đến".';
  }
  return null;
}

/** The line under a result's name: "Đời 3 · 1930 – 2001 · Hà Tĩnh". */
export function itemSubtitle(item: SearchItem): string {
  const parts = [`Đời ${item.generation}`];
  if (item.birth_year !== null || item.death_year !== null) {
    parts.push(`${item.birth_year ?? '?'} – ${item.death_year ?? '?'}`);
  }
  if (item.hometown) parts.push(item.hometown);
  if (item.is_spouse && item.spouse_of) parts.push(`vợ/chồng của ${item.spouse_of.name}`);
  else if (item.parent_name) parts.push(`con ${item.parent_name}`);
  return parts.join(' · ');
}

/** The tree shows blood members only, so a spouse leads to their partner. */
export function focusIdFor(item: SearchItem): number {
  return item.is_spouse && item.spouse_of ? item.spouse_of.id : item.id;
}

export function focusHref(id: number): string {
  return `/?focus=${id}`;
}

/**
 * Filters carried in the address (`/tim-kiem?generation=3&gender=female`, from the statistics page's bars). Unknown values
 * are ignored rather than trusted: a bad `gender` must never reach the API as a 422 surprise.
 */
export function filtersFromSearch(search: string): SearchFilters {
  const params = new URLSearchParams(search);
  const text = (key: string) => (params.get(key) ?? '').trim();
  const digits = (key: string) => (/^\d{1,4}$/.test(text(key)) ? text(key) : '');
  const gender = text('gender');
  const status = text('status');
  return {
    q: text('q'),
    generation: digits('generation'),
    branch: /^\d+$/.test(text('branch')) ? text('branch') : '',
    bornFrom: digits('born_from'),
    bornTo: digits('born_to'),
    hometown: text('hometown'),
    gender: (['male', 'female', 'other', 'unknown'] as const).find((g) => g === gender) ?? '',
    status: (['living', 'deceased', 'unknown'] as const).find((s) => s === status) ?? '',
  };
}

/** `?focus=12` -> 12 (anything else -> null). */
export function parseFocusParam(search: string): number | null {
  const raw = new URLSearchParams(search).get('focus');
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

export function pageLabel(total: number, offset: number, count: number): string {
  if (total === 0 || count === 0) return '0 kết quả';
  return `${offset + 1}–${offset + count} / ${total} kết quả`;
}
