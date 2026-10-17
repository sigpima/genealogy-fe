/** The cookie the API reads to know which family a guest/signup refers to (set by the /t/<slug> route). */
export const TREE_SLUG_COOKIE = 'tree_slug';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same rule as the API's tree slugs; keeps odd characters out of the cookie and the URL. */
export function isValidTreeSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 60 && SLUG_PATTERN.test(slug);
}

export type SiteInfoState = {
  status: 'loading' | 'ok' | 'unknown';
  treeName: string | null;
};

export function signupTreeNotice(state: SiteInfoState): string | null {
  if (state.status === 'unknown') {
    return 'Hãy mở liên kết gia phả của họ bạn (dạng …/t/<tên-họ>) rồi đăng ký từ đó.';
  }
  if (state.status === 'ok' && state.treeName)
    return `Bạn đang đăng ký vào gia phả: ${state.treeName}.`;
  return null;
}
