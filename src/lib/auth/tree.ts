/** The cookie the API reads to know which family a guest refers to (set by the /t/<slug> route). */
export const TREE_SLUG_COOKIE = 'tree_slug';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same rule as the API's tree slugs; keeps odd characters out of the cookie and the URL. */
export function isValidTreeSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 60 && SLUG_PATTERN.test(slug);
}
