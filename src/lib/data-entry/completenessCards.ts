import type { Completeness, MissingField } from './types';

export type CompletenessCard = {
  field: MissingField;
  label: string;
  have: number;
  total: number;
  percent: number;
  note?: string;
};

/** The five fixed progress cards of the data-entry page, one per "missing" filter. */
export function completenessCards(c: Completeness): CompletenessCard[] {
  const make = (field: MissingField, have: number, label: string, note?: string): CompletenessCard => ({
    field,
    label,
    have,
    total: c.total,
    percent: c.total === 0 ? 0 : Math.round((have / c.total) * 100),
    ...(note ? { note } : {}),
  });
  return [
    make('gender', c.with_gender, 'đã có giới tính'),
    make('birth_year', c.with_birth_year, 'đã có năm sinh'),
    make('hometown', c.with_hometown, 'đã có quê quán'),
    make('death_year', c.with_death_year, 'đã có năm mất', 'người còn sống không có năm mất'),
    make('avatar', c.with_avatar, 'đã có ảnh đại diện'),
  ];
}
