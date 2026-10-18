import type { Gender } from '@/lib/tree/types';

export const MISSING_FIELDS = ['gender', 'birth_year', 'hometown', 'death_year', 'avatar'] as const;
export type MissingField = (typeof MISSING_FIELDS)[number];

export const MISSING_LABELS: Record<MissingField, string> = {
  gender: 'Thiếu giới tính',
  birth_year: 'Thiếu năm sinh',
  hometown: 'Thiếu quê quán',
  death_year: 'Chưa có năm mất',
  avatar: 'Thiếu ảnh đại diện',
};

/** One row of `GET /api/members/table` (spouses are never rows). */
export type TableRow = {
  id: number;
  full_name: string;
  generation: number;
  parent_id: number | null;
  parent_name: string | null;
  has_children: boolean;
  gender: Gender | null;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_is_lunar: boolean;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_is_lunar: boolean;
  courtesy_name: string | null;
  title: string | null;
  hometown: string | null;
  residence: string | null;
  phone: string | null;
  email: string | null;
  birth_order: number | null;
  is_adopted: boolean;
  mother_id: number | null;
};

export type TablePage = { total: number; items: TableRow[] };

export type Completeness = {
  total: number;
  with_gender: number;
  with_birth_year: number;
  with_hometown: number;
  basic: number;
  with_death_year: number;
  with_avatar: number;
};

export type TableFilters = {
  q: string;
  generation: number | null;
  /** A member id: only that member's branch. */
  under: number | null;
  missing: MissingField[];
};

export type ImportSummary = { dry_run: boolean; created: number; updated: number; unchanged: number };
export type ImportRowError = { row: number; message: string };
