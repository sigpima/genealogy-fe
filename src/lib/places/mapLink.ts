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
