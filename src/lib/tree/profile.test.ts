import { describe, expect, it } from 'vitest';
import { coordinatesFromInputs, formatCoordinates, mapsUrl, toNullableText } from './profile';

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

describe('mapsUrl / formatCoordinates', () => {
  it('builds a maps link and a readable label', () => {
    expect(mapsUrl(18.55, 105.72)).toBe('https://www.google.com/maps?q=18.55,105.72');
    expect(formatCoordinates(18.55, 105.72)).toBe('18.55, 105.72');
  });
});
