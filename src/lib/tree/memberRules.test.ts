import { describe, expect, it } from 'vitest';
import { canBeAdopted } from './memberRules';

describe('canBeAdopted', () => {
  it('is false for the founding ancestor, who has no father', () => {
    expect(canBeAdopted({ parent_id: null })).toBe(false);
  });
  it('is true for anybody with a father', () => {
    expect(canBeAdopted({ parent_id: 7 })).toBe(true);
  });
});
