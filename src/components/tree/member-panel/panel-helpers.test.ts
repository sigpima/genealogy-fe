import { describe, expect, it } from 'vitest';
import { draftFromProfile, draftFromSpouse, parseYear, toInputValue } from './draft';
import { hasProfileInfo, motherNameOf } from './profileInfo';
import type { PanelProfile } from './types';

const EMPTY: PanelProfile = {
  courtesyName: null,
  title: null,
  residence: null,
  burialPlace: null,
  burialLatitude: null,
  burialLongitude: null,
  burialPlaceId: null,
  burialPlot: null,
  burialMapUrl: null,
  hometown: null,
  phone: null,
  email: null,
  birthMonth: null,
  birthDay: null,
  deathMonth: null,
  deathDay: null,
  birthIsLunar: false,
  birthLeapMonth: false,
  deathIsLunar: false,
  deathLeapMonth: false,
  birthOrder: null,
  isAdopted: false,
  motherId: null,
};

describe('draft helpers', () => {
  it('turns numbers into input text and back', () => {
    expect(toInputValue(null)).toBe('');
    expect(toInputValue(1990)).toBe('1990');
    expect(parseYear('')).toBeNull();
    expect(parseYear('  ')).toBeNull();
    expect(parseYear('abc')).toBeNull();
    expect(parseYear('1990')).toBe(1990);
  });

  it('mirrors a profile into form text', () => {
    const draft = draftFromProfile({ ...EMPTY, hometown: 'Huế', birthMonth: 3, birthIsLunar: true, motherId: 7 });
    expect(draft).toMatchObject({ hometown: 'Huế', birthMonth: '3', birthIsLunar: true, motherId: '7', phone: '', birthOrder: '' });
  });

  it('mirrors a spouse into form text', () => {
    const draft = draftFromSpouse({
      marriageId: 1, spouseId: 2, name: 'Lan', birthYear: 1950, deathYear: null, gender: 'female', notes: null, marriageYear: 1975,
    });
    expect(draft).toEqual({ name: 'Lan', birthYear: '1950', deathYear: '', gender: 'female', notes: '', marriageYear: '1975' });
  });
});

describe('profile info', () => {
  it('finds the mother among the options', () => {
    const options = [{ id: 7, name: 'Trần Thị Lan' }];
    expect(motherNameOf({ ...EMPTY, motherId: 7 }, options)).toBe('Trần Thị Lan');
    expect(motherNameOf({ ...EMPTY, motherId: 9 }, options)).toBeNull();
    expect(motherNameOf(EMPTY, options)).toBeNull();
  });

  it('has nothing to show for an empty profile', () => {
    expect(hasProfileInfo(EMPTY, null, null, null)).toBe(false);
  });

  it.each([
    ['title', { title: 'Cử nhân' }],
    ['a map link', { burialMapUrl: 'https://maps.app.goo.gl/x' }],
    ['a birth month', { birthMonth: 2 }],
    ['birth order', { birthOrder: 1 }],
    ['adoption', { isAdopted: true }],
  ])('shows the block for %s', (_label, patch) => {
    expect(hasProfileInfo({ ...EMPTY, ...patch }, null, null, null)).toBe(true);
  });

  it('shows the block for a branch, a resting place or a mother', () => {
    expect(hasProfileInfo(EMPTY, { id: 1, name: 'Chi 1', color: '#fff' }, null, null)).toBe(true);
    expect(hasProfileInfo(EMPTY, null, { id: 1, name: 'Nghĩa trang', kind: 'cemetery', latitude: null, longitude: null }, null)).toBe(true);
    expect(hasProfileInfo(EMPTY, null, null, 'Lan')).toBe(true);
  });
});
