import { describe, expect, it } from 'vitest';
import { foldText } from './text';

describe('foldText', () => {
  it('ignores tone marks wherever they are placed', () => {
    expect(foldText('Nguyễn Văn Hòa')).toBe('nguyen van hoa');
    expect(foldText('hoà')).toBe(foldText('hòa'));
  });
  it('maps đ to d and collapses spaces', () => {
    expect(foldText('  Đặng   Đình ')).toBe('dang dinh');
  });
  it('treats decomposed input like precomposed input', () => {
    expect(foldText('Nguyễn')).toBe('nguyen');
  });
  it('is empty for nothing', () => {
    expect(foldText('  ')).toBe('');
  });
});
