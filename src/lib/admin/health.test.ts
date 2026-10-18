import { describe, expect, it } from 'vitest';
import { groupFindings, healthHeadline, type Finding } from './health';

const f = (kind: string, name: string | null, severity: Finding['severity'] = 'warning'): Finding => ({
  kind,
  severity,
  member_id: name ? 1 : null,
  member_name: name,
  message: 'm',
});

describe('groupFindings', () => {
  it('groups by kind in the order the checks matter, warnings before info, with a Vietnamese label', () => {
    const groups = groupFindings([f('media_orphan', null, 'info'), f('duplicate_name_year', 'A'), f('child_before_parent', 'B'), f('child_before_parent', 'C')]);
    expect(groups.map((g) => g.kind)).toEqual(['child_before_parent', 'duplicate_name_year', 'media_orphan']);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].label).toMatch(/trước cha/i);
    expect(groups.every((g) => g.label.length > 5)).toBe(true);
  });
  it('keeps an unknown kind rather than dropping it', () => {
    expect(groupFindings([f('weird', 'A')]).map((g) => g.kind)).toEqual(['weird']);
  });
});

describe('healthHeadline', () => {
  it('says the data is fine when nothing needs a look', () => {
    expect(healthHeadline([])).toBe('Dữ liệu ổn: chưa thấy chỗ nào đáng ngờ.');
  });
  it('counts warnings and notes separately', () => {
    expect(healthHeadline([f('a', 'A'), f('b', 'B'), f('c', null, 'info')])).toBe('2 chỗ cần xem lại, 1 ghi chú nhỏ.');
    expect(healthHeadline([f('c', null, 'info')])).toBe('Không có chỗ nào sai rõ ràng, 1 ghi chú nhỏ.');
  });
});
