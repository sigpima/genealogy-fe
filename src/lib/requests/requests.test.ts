import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  changeLines,
  changesFromForm,
  childChanges,
  fieldLabel,
  formatFieldValue,
  formFromDetail,
  formFromPanel,
  kindLabel,
  requestErrorMessage,
  statusLabel,
} from './requests';
import { toPanelProfile } from '../tree/profile';
import { EMPTY_API_PROFILE, type MemberDetail } from '../tree/types';

const detail: MemberDetail = {
  ...EMPTY_API_PROFILE,
  id: 1,
  birth_year: 1930,
  death_year: null,
  gender: 'male',
  notes: null,
  avatar_url: null,
  sibling_rank: null,
  spouses: [],
  hometown: 'Huế',
};
const original = formFromDetail('Nguyễn Văn Con', detail);

describe('formFromDetail', () => {
  it('turns null into blanks and numbers into strings', () => {
    expect(original.birth_year).toBe('1930');
    expect(original.death_year).toBe('');
    expect(original.hometown).toBe('Huế');
    expect(original.full_name).toBe('Nguyễn Văn Con');
    expect(original.death_is_lunar).toBe(true);
  });
});

describe('formFromPanel', () => {
  it('matches the form built from the API detail, so an unchanged panel proposes nothing', () => {
    const fromPanel = formFromPanel('Nguyễn Văn Con', {
      birthYear: detail.birth_year,
      deathYear: detail.death_year,
      gender: detail.gender,
      notes: detail.notes,
      profile: toPanelProfile(detail),
    });
    expect(fromPanel).toEqual(original);
  });
});

describe('changesFromForm', () => {
  it('is empty when nothing changed', () => {
    expect(changesFromForm(original, { ...original })).toEqual({ ok: true, changes: {} });
  });
  it('lists only what differs, typed for the API', () => {
    const result = changesFromForm(original, { ...original, birth_year: '1931', hometown: ' Hà Tĩnh ', gender: 'female', is_adopted: true });
    expect(result).toEqual({ ok: true, changes: { birth_year: 1931, hometown: 'Hà Tĩnh', gender: 'female', is_adopted: true } });
  });
  it('sends null for a cleared field, and ignores whitespace-only differences', () => {
    expect(changesFromForm(original, { ...original, hometown: '' })).toEqual({ ok: true, changes: { hometown: null } });
    expect(changesFromForm(original, { ...original, hometown: ' Huế ' })).toEqual({ ok: true, changes: {} });
    expect(changesFromForm(original, { ...original, gender: '' })).toEqual({ ok: true, changes: { gender: null } });
  });
  it('rejects a blank name and out-of-range numbers', () => {
    expect(changesFromForm(original, { ...original, full_name: ' ' })).toMatchObject({ ok: false });
    expect(changesFromForm(original, { ...original, birth_month: '13' })).toMatchObject({ ok: false, error: expect.stringContaining('Tháng sinh') });
    expect(changesFromForm(original, { ...original, birth_year: 'abc' })).toMatchObject({ ok: false });
  });
});

describe('childChanges', () => {
  it('needs a name and keeps what was given', () => {
    expect(childChanges(' ', '', '')).toMatchObject({ ok: false });
    expect(childChanges(' Cháu ', 'female', '1960')).toEqual({ ok: true, changes: { full_name: 'Cháu', gender: 'female', birth_year: 1960 } });
    expect(childChanges('Cháu', '', '')).toEqual({ ok: true, changes: { full_name: 'Cháu' } });
    expect(childChanges('Cháu', '', '19x')).toMatchObject({ ok: false });
  });
});

describe('labels and formatting', () => {
  it('formats values for a before/after table', () => {
    expect(formatFieldValue('hometown', null)).toBe('(trống)');
    expect(formatFieldValue('gender', 'female')).toBe('Nữ');
    expect(formatFieldValue('is_adopted', true)).toBe('Có');
    expect(formatFieldValue('birth_year', 1930)).toBe('1930');
  });
  it('names fields, kinds, statuses and actions', () => {
    expect(fieldLabel('birth_year')).toBe('Năm sinh');
    expect(fieldLabel('mystery')).toBe('mystery');
    expect(kindLabel('add_child')).toMatch(/con/);
    expect(statusLabel('pending')).toBe('Chờ duyệt');
    expect(actionLabel('member.update')).toBe('Sửa thông tin');
    expect(actionLabel('weird.thing')).toBe('weird.thing');
  });
  it('writes audit changes as lines', () => {
    expect(changeLines({ birth_year: [1930, 1931], hometown: [null, 'Huế'] })).toEqual([
      'Năm sinh: 1930 → 1931',
      'Quê quán: (trống) → Huế',
    ]);
    expect(changeLines(null)).toEqual([]);
  });
  it('explains refusals', () => {
    expect(requestErrorMessage(409, 'request already approved')).toMatch(/đã được xử lý/);
    expect(requestErrorMessage(409, 'the person no longer exists')).toMatch(/đã bị xoá/);
    expect(requestErrorMessage(422, 'the proposal changes nothing')).toMatch(/chưa thay đổi/);
    expect(requestErrorMessage(422, 'give a reason')).toMatch(/lý do/);
    expect(requestErrorMessage(500, null)).toMatch(/thử lại/);
  });
});
