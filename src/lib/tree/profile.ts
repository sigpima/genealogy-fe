import type { MemberProfile, PanelProfile } from './types';

export function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export type CoordinatesResult =
  | { ok: true; latitude: number | null; longitude: number | null }
  | { ok: false; error: string };

function parseCoordinate(raw: string, min: number, max: number): number | null | undefined {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

/** Both blank = no coordinates; both valid = a pair; anything else is an error (mirrors the API). */
export function coordinatesFromInputs(latitudeText: string, longitudeText: string): CoordinatesResult {
  const latitude = parseCoordinate(latitudeText, -90, 90);
  const longitude = parseCoordinate(longitudeText, -180, 180);
  if (latitude === undefined) return { ok: false, error: 'Vĩ độ phải là số từ -90 đến 90.' };
  if (longitude === undefined) return { ok: false, error: 'Kinh độ phải là số từ -180 đến 180.' };
  if ((latitude === null) !== (longitude === null)) {
    return { ok: false, error: 'Nhập đủ cả vĩ độ và kinh độ, hoặc để trống cả hai.' };
  }
  return { ok: true, latitude, longitude };
}

export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude}, ${longitude}`;
}

/** API (snake_case) -> panel (camelCase). */
export function toPanelProfile(detail: MemberProfile): PanelProfile {
  return {
    courtesyName: detail.courtesy_name,
    title: detail.title,
    residence: detail.residence,
    burialPlace: detail.burial_place,
    burialLatitude: detail.burial_latitude,
    burialLongitude: detail.burial_longitude,
    hometown: detail.hometown,
    phone: detail.phone,
    email: detail.email,
    birthMonth: detail.birth_month,
    birthDay: detail.birth_day,
    deathMonth: detail.death_month,
    deathDay: detail.death_day,
    birthIsLunar: detail.birth_is_lunar,
    birthLeapMonth: detail.birth_leap_month,
    deathIsLunar: detail.death_is_lunar,
    deathLeapMonth: detail.death_leap_month,
    birthOrder: detail.birth_order,
    isAdopted: detail.is_adopted,
    motherId: detail.mother_id,
  };
}

/** Panel -> the profile part of a `PUT` body. `PUT` replaces the whole member, so every field is always sent. */
export function profileToPayload(profile: PanelProfile): MemberProfile {
  return {
    courtesy_name: profile.courtesyName,
    title: profile.title,
    residence: profile.residence,
    burial_place: profile.burialPlace,
    burial_latitude: profile.burialLatitude,
    burial_longitude: profile.burialLongitude,
    hometown: profile.hometown,
    phone: profile.phone,
    email: profile.email,
    birth_month: profile.birthMonth,
    birth_day: profile.birthDay,
    death_month: profile.deathMonth,
    death_day: profile.deathDay,
    birth_is_lunar: profile.birthIsLunar,
    birth_leap_month: profile.birthLeapMonth,
    death_is_lunar: profile.deathIsLunar,
    death_leap_month: profile.deathLeapMonth,
    birth_order: profile.birthOrder,
    is_adopted: profile.isAdopted,
    mother_id: profile.motherId,
  };
}

/** Blank -> null; otherwise a whole number inside [min, max], else undefined (the form shows an error). */
export function parseBoundedInt(raw: string, min: number, max: number): number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || value > max) return undefined;
  return value;
}

const PHONE_PATTERN = /^[0-9+\-(). ]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cheap client-side checks mirroring the API (which stays the authority): returns an error text or null. */
export function contactError(phone: string, email: string): string | null {
  if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) {
    return 'Số điện thoại chỉ gồm chữ số và + - ( ) . và khoảng trắng.';
  }
  if (email.trim() && !EMAIL_PATTERN.test(email.trim())) return 'Email chưa đúng định dạng.';
  return null;
}
