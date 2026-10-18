// A hint for the form only: the API checks the link again and stays the authority.
const HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl']);

/** Blank is fine (no link); otherwise it must be an https link to Google Maps. */
export function looksLikeMapLink(raw: string): boolean {
  const text = raw.trim();
  if (text === '') return true;
  if (text.length > 500 || /\s/.test(text)) return false;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return HOSTS.has(host) || (host === 'goo.gl' && url.pathname.startsWith('/maps'));
}

/** A Maps link for an old row that only has coordinates. */
export function fallbackMapHref(latitude: number | null, longitude: number | null): string | null {
  if (latitude === null || longitude === null) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

/** What "Xem trên bản đồ" opens: the saved link, else the old coordinates. */
export function mapHrefFor(link: string | null, latitude: number | null, longitude: number | null): string | null {
  return link ?? fallbackMapHref(latitude, longitude);
}

const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';
const POSITION_PATTERNS = [
  new RegExp(`@${NUMBER},${NUMBER}`),
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
  new RegExp(`[?&](?:q|ll|query)=${NUMBER}(?:,|%2C)${NUMBER}(?:&|$)`),
  new RegExp(`/maps/place/${NUMBER},${NUMBER}(?:/|$|\\?)`),
];

/** The position a link carries, if any — the same forms the API reads (`coordinates_from`), which then decides the place's position. */
export function linkCoordinates(url: string): [number, number] | null {
  for (const pattern of POSITION_PATTERNS) {
    const found = pattern.exec(url);
    if (found) {
      const lat = Number(found[1]);
      const lng = Number(found[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
    }
  }
  return null;
}
