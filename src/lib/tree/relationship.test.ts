import { describe, expect, it } from 'vitest';
import { relationLines, type Relationship } from './relationship';

const base: Relationship = { kind: 'blood', a_is: 'chú', b_is: 'cháu', sentence: 'Cường là chú của Anh.', common_ancestor: { id: 1, name: 'Tổ' }, steps_a: 1, steps_b: 2 };

describe('relationLines', () => {
  it('says what each is to the other and names the common ancestor', () => {
    expect(relationLines(base, 'Cường', 'Anh')).toEqual([
      'Cường là chú của Anh.',
      'Anh là cháu của Cường.',
      'Tổ chung gần nhất: Tổ (cách Cường 1 đời, cách Anh 2 đời).',
    ]);
  });
  it('leaves out the ancestor line when the ancestor is one of the two', () => {
    const parent: Relationship = { ...base, a_is: 'cha', b_is: 'con', sentence: 'Tổ là cha của An.', common_ancestor: { id: 1, name: 'Tổ' }, steps_a: 0, steps_b: 1 };
    expect(relationLines(parent, 'Tổ', 'An')).toEqual(['Tổ là cha của An.', 'An là con của Tổ.']);
  });
  it('shows only the sentence for the same person or unrelated people', () => {
    expect(relationLines({ ...base, kind: 'none', sentence: 'Không có quan hệ.', a_is: null, b_is: null, common_ancestor: null }, 'A', 'B')).toEqual(['Không có quan hệ.']);
  });
});
