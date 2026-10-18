import { describe, expect, it } from 'vitest';
import { completenessCards } from './completenessCards';
import type { Completeness } from './types';

const sample: Completeness = {
  total: 810,
  with_gender: 120,
  with_birth_year: 405,
  with_hometown: 81,
  basic: 100,
  with_death_year: 200,
  with_avatar: 8,
};

describe('completenessCards', () => {
  it('always gives the five cards in a fixed order', () => {
    expect(completenessCards(sample).map((c) => c.field)).toEqual(['gender', 'birth_year', 'hometown', 'death_year', 'avatar']);
  });

  it('counts what is filled in and says it in words', () => {
    const [gender, birth] = completenessCards(sample);
    expect(gender).toMatchObject({ have: 120, total: 810, percent: 15, label: 'đã có giới tính' });
    expect(birth).toMatchObject({ have: 405, percent: 50, label: 'đã có năm sinh' });
  });

  it('explains the death-year card only', () => {
    const cards = completenessCards(sample);
    expect(cards.find((c) => c.field === 'death_year')?.note).toBe('người còn sống không có năm mất');
    expect(cards.filter((c) => c.note !== undefined)).toHaveLength(1);
  });

  it('has 0 percent for an empty tree', () => {
    const cards = completenessCards({ ...sample, total: 0, with_gender: 0, with_birth_year: 0, with_hometown: 0, with_death_year: 0, with_avatar: 0 });
    expect(cards.every((c) => c.percent === 0)).toBe(true);
  });
});
