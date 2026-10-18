import type { Completeness, MissingField, TableFilters } from './types';

export const PAGE_SIZE = 100;

export const EMPTY_FILTERS: TableFilters = { q: '', generation: null, under: null, missing: [] };

/** Query string for `GET /api/members/table`; several "missing" chips repeat the key (all must be empty). */
export function buildTableQuery(filters: TableFilters, offset: number, limit: number = PAGE_SIZE): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.generation !== null) params.set('generation', String(filters.generation));
  if (filters.under !== null) params.set('under', String(filters.under));
  for (const field of filters.missing) params.append('missing', field);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return params.toString();
}

export function hasActiveFilters(filters: TableFilters): boolean {
  return Boolean(filters.q.trim()) || filters.generation !== null || filters.under !== null || filters.missing.length > 0;
}

/** `?missing=gender,avatar&generation=3` (from the statistics page's completeness board) -> initial grid filters. */
export function filtersFromAddress(search: string, allowed: readonly MissingField[]): TableFilters {
  const params = new URLSearchParams(search);
  const missing = (params.get('missing') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is MissingField => (allowed as readonly string[]).includes(s));
  const generation = /^\d{1,3}$/.test(params.get('generation') ?? '') ? Number(params.get('generation')) : null;
  return { ...EMPTY_FILTERS, missing: [...new Set(missing)], generation };
}

export function toggleMissing<T extends string>(current: T[], field: T): T[] {
  return current.includes(field) ? current.filter((f) => f !== field) : [...current, field];
}

export function pageRange(total: number, offset: number, count: number): string {
  if (total === 0 || count === 0) return '0';
  return `${offset + 1}–${offset + count} / ${total}`;
}
