import { coordinatesFromInputs } from '../tree/profile';
import { looksLikeMapLink } from './mapLink';

export type PlaceKind = 'clan_house' | 'temple' | 'tomb' | 'cemetery' | 'other';

export type Place = {
  id: number;
  kind: PlaceKind;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  description: string | null;
  caretaker: string | null;
  visit_notes: string | null;
  resting_count: number;
  media_count: number;
};

export type Resident = { id: number; full_name: string; plot: string | null; birth_year: number | null; death_year: number | null };
export type PlaceDetail = Place & { residents: Resident[] };

export type MigrationGroup = { name: string; count: number; latitude: number | null; longitude: number | null; existing: boolean };
export type MigrationResult = { dry_run: boolean; groups: MigrationGroup[]; created: number; linked: number };

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  clan_house: 'Nhà thờ họ / từ đường',
  temple: 'Đền, chùa',
  tomb: 'Lăng mộ',
  cemetery: 'Nghĩa trang',
  other: 'Khác',
};

/** Marker colours on the map, one per kind (kept distinct enough to tell apart at a glance). */
export const PLACE_KIND_COLORS: Record<PlaceKind, string> = {
  clan_house: '#8b1a1a',
  temple: '#c59b27',
  tomb: '#2e7d32',
  cemetery: '#1565c0',
  other: '#6a1b9a',
};

export function hasCoordinates(place: Pick<Place, 'latitude' | 'longitude'>): boolean {
  return place.latitude !== null && place.longitude !== null;
}

/** "Chỉ đường": Google Maps directions to the point (works from any phone, no API key). */
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

/** Filter places by kind ('' = all) and by a name/address search ignoring case. */
export function filterPlaces(places: Place[], kind: '' | PlaceKind, query: string): Place[] {
  const needle = query.trim().toLowerCase();
  return places.filter(
    (p) => (kind === '' || p.kind === kind) && (!needle || `${p.name} ${p.address ?? ''}`.toLowerCase().includes(needle)),
  );
}

export type PlaceForm = {
  kind: PlaceKind;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  map_url: string;
  description: string;
  caretaker: string;
  visit_notes: string;
};

export const EMPTY_PLACE_FORM: PlaceForm = {
  kind: 'clan_house',
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  map_url: '',
  description: '',
  caretaker: '',
  visit_notes: '',
};

export function placeToForm(place: Place): PlaceForm {
  return {
    kind: place.kind,
    name: place.name,
    address: place.address ?? '',
    latitude: place.latitude === null ? '' : String(place.latitude),
    longitude: place.longitude === null ? '' : String(place.longitude),
    map_url: place.map_url ?? '',
    description: place.description ?? '',
    caretaker: place.caretaker ?? '',
    visit_notes: place.visit_notes ?? '',
  };
}

export type PlacePayloadResult =
  | { ok: true; payload: Omit<Place, 'id' | 'resting_count' | 'media_count'> }
  | { ok: false; error: string };

const blank = (text: string) => text.trim() || null;

/** Check the form like the API will (name, both-or-neither GPS in range) and build the request body. */
export function placePayload(form: PlaceForm): PlacePayloadResult {
  const name = form.name.trim();
  if (!name) return { ok: false, error: 'Hãy nhập tên địa điểm.' };
  const gps = coordinatesFromInputs(form.latitude, form.longitude);
  if (!gps.ok) return { ok: false, error: gps.error };
  if (!looksLikeMapLink(form.map_url)) return { ok: false, error: 'Link bản đồ phải là link Google Maps (https).' };
  return {
    ok: true,
    payload: {
      kind: form.kind,
      name,
      address: blank(form.address),
      latitude: gps.latitude,
      longitude: gps.longitude,
      map_url: blank(form.map_url),
      description: blank(form.description),
      caretaker: blank(form.caretaker),
      visit_notes: blank(form.visit_notes),
    },
  };
}

/** One line for the migration preview: "Nghĩa trang Phú Ốc — 12 người (có toạ độ)". */
export function migrationLine(group: MigrationGroup): string {
  const parts = [`${group.count} người`];
  if (group.latitude !== null) parts.push('có toạ độ');
  parts.push(group.existing ? 'dùng địa điểm đã có' : 'sẽ tạo mới');
  return `${group.name} — ${parts.join(', ')}`;
}

export function placeErrorMessage(status: number): string {
  if (status === 422) return 'Thông tin chưa hợp lệ: kiểm tra tên và toạ độ.';
  if (status === 404) return 'Không tìm thấy địa điểm (có thể đã bị xoá).';
  if (status === 401 || status === 403) return 'Bạn không có quyền sửa địa điểm.';
  return 'Không thể lưu. Vui lòng thử lại.';
}
