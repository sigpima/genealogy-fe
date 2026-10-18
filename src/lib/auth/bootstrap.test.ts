import { describe, expect, it } from 'vitest';
import { bootstrapErrorMessage, bootstrapNotice } from './bootstrap';

describe('bootstrap texts', () => {
  it('tells the first person that this account will own the platform', () => {
    expect(bootstrapNotice(false)).toMatch(/quản trị tối cao/);
  });
  it('mentions the code only when one is required', () => {
    expect(bootstrapNotice(true)).toMatch(/mã khởi tạo/i);
    expect(bootstrapNotice(false)).not.toMatch(/mã khởi tạo/i);
  });
  it('explains a refused code without saying anything about what the code is', () => {
    expect(bootstrapErrorMessage()).toMatch(/mã khởi tạo/i);
    expect(bootstrapErrorMessage()).toMatch(/BOOTSTRAP_CODE/);
  });
});
