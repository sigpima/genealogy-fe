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
