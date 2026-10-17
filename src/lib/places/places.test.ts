import { describe, expect, it } from 'vitest';
import {
  directionsUrl,
  EMPTY_PLACE_FORM,
  filterPlaces,
  hasCoordinates,
  migrationLine,
  placePayload,
  placeToForm,
  type Place,
} from './places';

const place = (over: Partial<Place> = {}): Place => ({
  id: 1,
  kind: 'clan_house',
  name: 'Nhà thờ họ',
  address: 'Xã Phú Ốc',
  latitude: 18.55,
  longitude: 105.72,
  description: null,
  caretaker: null,
  visit_notes: null,
  resting_count: 0,
  media_count: 0,
  ...over,
});

describe('places helpers', () => {
  it('builds a Google Maps directions link', () => {
    expect(directionsUrl(18.55, 105.72)).toBe('https://www.google.com/maps/dir/?api=1&destination=18.55,105.72');
  });
  it('knows whether a place can be put on the map', () => {
    expect(hasCoordinates(place())).toBe(true);
    expect(hasCoordinates(place({ latitude: null, longitude: null }))).toBe(false);
  });
  it('filters by kind and by name/address', () => {
    const list = [place(), place({ id: 2, kind: 'tomb', name: 'Lăng ông Tổ', address: null })];
    expect(filterPlaces(list, '', '').length).toBe(2);
    expect(filterPlaces(list, 'tomb', '').map((p) => p.id)).toEqual([2]);
    expect(filterPlaces(list, '', 'PHÚ ỐC').map((p) => p.id)).toEqual([1]);
    expect(filterPlaces(list, 'tomb', 'nhà thờ')).toEqual([]);
  });
  it('describes a migration group', () => {
    expect(migrationLine({ name: 'Nghĩa trang A', count: 3, latitude: 1, longitude: 2, existing: false })).toBe(
      'Nghĩa trang A — 3 người, có toạ độ, sẽ tạo mới',
    );
    expect(migrationLine({ name: 'B', count: 1, latitude: null, longitude: null, existing: true })).toBe('B — 1 người, dùng địa điểm đã có');
  });
});

describe('placePayload', () => {
  it('needs a name and accepts coordinates in range, with a decimal comma', () => {
    expect(placePayload(EMPTY_PLACE_FORM)).toMatchObject({ ok: false });
    const ok = placePayload({ ...EMPTY_PLACE_FORM, name: ' Lăng ', latitude: '18,5', longitude: '105.7', address: ' ' });
    expect(ok).toEqual({
      ok: true,
      payload: { kind: 'clan_house', name: 'Lăng', address: null, latitude: 18.5, longitude: 105.7, description: null, caretaker: null, visit_notes: null },
    });
  });
  it('rejects half a coordinate and out-of-range values', () => {
    expect(placePayload({ ...EMPTY_PLACE_FORM, name: 'x', latitude: '18' })).toMatchObject({ ok: false });
    expect(placePayload({ ...EMPTY_PLACE_FORM, name: 'x', latitude: '95', longitude: '10' })).toMatchObject({ ok: false });
  });
  it('round-trips a place through the form', () => {
    const p = place({ description: 'Chính', caretaker: 'Ông Tư', visit_notes: 'Mang hương' });
    const result = placePayload(placeToForm(p));
    expect(result).toEqual({ ok: true, payload: Object.fromEntries(Object.entries(p).filter(([k]) => !['id', 'resting_count', 'media_count'].includes(k))) });
  });
});
