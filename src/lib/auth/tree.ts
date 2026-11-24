/** The cookie the API reads to know which family a guest refers to (set by the /t/<slug> route). */
export const TREE_SLUG_COOKIE = 'tree_slug';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same rule as the API's tree slugs; keeps odd characters out of the cookie and the URL. */
export function isValidTreeSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 60 && SLUG_PATTERN.test(slug);
}

/** The fake family behind /guest (the API's scripts/seed_demo.py makes it). */
export const DEMO_TREE_SLUG = 'demo';

export function isDemoTree(slug: string | null | undefined): boolean {
  return slug === DEMO_TREE_SLUG;
}

/** The Set-Cookie value that makes this browser's guest requests mean the family with this slug (a year). */
export function treeSlugSetCookie(slug: string): string {
  return `${TREE_SLUG_COOKIE}=${slug}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
