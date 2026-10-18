import { describe, expect, it } from 'vitest';
import {
  contactError,
  coordinatesFromInputs,
  parseBoundedInt,
  profileToPayload,
  toNullableText,
  toPanelProfile,
} from './profile';
import { EMPTY_API_PROFILE } from './types';

describe('toNullableText', () => {
  it('trims and turns blank into null', () => {
    expect(toNullableText('  Phúc Khang ')).toBe('Phúc Khang');
    expect(toNullableText('   ')).toBeNull();
    expect(toNullableText('')).toBeNull();
  });
});

describe('coordinatesFromInputs', () => {
  it('accepts a valid pair, including a decimal comma', () => {
    expect(coordinatesFromInputs('18.55', '105.72')).toEqual({ ok: true, latitude: 18.55, longitude: 105.72 });
    expect(coordinatesFromInputs('18,55', '105,72')).toEqual({ ok: true, latitude: 18.55, longitude: 105.72 });
  });
  it('treats two blanks as no coordinates', () => {
    expect(coordinatesFromInputs('', '  ')).toEqual({ ok: true, latitude: null, longitude: null });
  });
  it('rejects half a pair', () => {
    const result = coordinatesFromInputs('18.55', '');
    expect(result.ok).toBe(false);
  });
  it('rejects out-of-range and non-numeric values', () => {
    expect(coordinatesFromInputs('91', '10').ok).toBe(false);
    expect(coordinatesFromInputs('10', '-181').ok).toBe(false);
    expect(coordinatesFromInputs('abc', '10').ok).toBe(false);
  });
  it('accepts the boundaries', () => {
    expect(coordinatesFromInputs('-90', '180').ok).toBe(true);
  });
});


describe('toPanelProfile / profileToPayload', () => {
  it('round-trips every field (PUT replaces the member, so none may be dropped)', () => {
    const api = {
      ...EMPTY_API_PROFILE,
      courtesy_name: 'Tự',
      hometown: 'Huế',
      phone: '0912',
      email: 'a@b.co',
      birth_month: 3,
      birth_day: 4,
      death_month: 5,
      death_day: 6,
      birth_is_lunar: true,
      birth_leap_month: true,
      death_is_lunar: false,
      death_leap_month: false,
      birth_order: 2,
      is_adopted: true,
      mother_id: 9,
      burial_latitude: 1.5,
      burial_longitude: 2.5,
      burial_place_id: 4,
      burial_plot: 'Khu B, mộ 12',
    };
    expect(profileToPayload(toPanelProfile(api))).toEqual(api);
  });
  it('covers every key of the API profile', () => {
    expect(Object.keys(profileToPayload(toPanelProfile(EMPTY_API_PROFILE))).sort()).toEqual(
      Object.keys(EMPTY_API_PROFILE).sort()
    );
  });
});

describe('parseBoundedInt', () => {
  it('blank is null, in-range integers pass, anything else is undefined', () => {
    expect(parseBoundedInt('  ', 1, 12)).toBeNull();
    expect(parseBoundedInt('7', 1, 12)).toBe(7);
    expect(parseBoundedInt('13', 1, 12)).toBeUndefined();
    expect(parseBoundedInt('0', 1, 12)).toBeUndefined();
    expect(parseBoundedInt('2.5', 1, 12)).toBeUndefined();
    expect(parseBoundedInt('abc', 1, 12)).toBeUndefined();
  });
});

describe('contactError', () => {
  it('accepts blanks and well-formed values, flags the rest', () => {
    expect(contactError('', '')).toBeNull();
    expect(contactError('+84 (912) 345-678', 'a@b.vn')).toBeNull();
    expect(contactError('call me', '')).toMatch(/điện thoại/);
    expect(contactError('', 'not-an-email')).toMatch(/Email/);
  });
});
