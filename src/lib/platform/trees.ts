export type TreeAdmin = { id: number; email: string; full_name: string; status: string };

/** One family as `GET /api/trees` returns it (superadmin only). */
export type PlatformTree = {
  id: number;
  name: string;
  slug: string;
  member_count: number;
  user_count: number;
  admins: TreeAdmin[];
  /** The family the superadmin is acting on right now. */
  is_current: boolean;
  /** Latest audit entry or login of the family (ISO), null when nothing has happened yet. */
  last_activity: string | null;
  status: 'active' | 'paused';
};

export type TreeCreated = { tree: PlatformTree; admin: TreeAdmin; admin_password: string | null };

export const ACTING_TREE_COOKIE = 'acting_tree';

/**
 * The cookie the API reads to know which family a superadmin acts on. Not a secret and not a permission:
 * the API only honours it for a superadmin and ignores it when it is not a real tree id.
 */
export function actingTreeCookie(treeId: number): string {
  return `${ACTING_TREE_COOKIE}=${treeId}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** "Nguyễn Tộc Làng Phú Ốc" -> "nguyen-toc-lang-phu-oc" (the suggestion shown next to the name field). */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length <= 60 && SLUG_PATTERN.test(slug);
}

export function familyLink(origin: string, slug: string): string {
  return `${origin}/t/${slug}`;
}

/** What to tell the superadmin when creating or renaming a family fails. */
export function treeErrorMessage(status: number, detail: unknown): string {
  const text = typeof detail === 'string' ? detail : '';
  if (status === 409 && /slug/.test(text)) return 'Đường dẫn (slug) này đã có họ khác dùng.';
  if (status === 409 && /email/.test(text)) return 'Email này đã có tài khoản.';
  if (status === 409 && /paused/.test(text)) return 'Hãy tạm ngưng họ này trước khi xoá.';
  if (status === 409 && /slug does not match/.test(text)) return 'Đường dẫn (slug) gõ lại chưa đúng.';
  if (status === 409 && /already/.test(text)) return 'Họ này đã ở trạng thái đó rồi.';
  if (status === 409) return 'Bị trùng với dữ liệu đã có.';
  if (status === 422) return 'Thông tin chưa hợp lệ: kiểm tra tên, slug, email và mật khẩu (từ 8 ký tự).';
  if (status === 401 || status === 403) return 'Chỉ quản trị tối cao mới dùng được chức năng này.';
  return 'Không thể thực hiện. Vui lòng thử lại.';
}

/**
 * Go into a family to help: the entry is logged on the platform FIRST, and only then is the acting-tree cookie set. If the
 * log line cannot be written the superadmin does not switch (returns false), so nothing goes unrecorded.
 */
export async function enterFamily(
  treeId: number,
  deps: { fetchFn?: typeof fetch; setCookie?: (cookie: string) => void } = {},
): Promise<boolean> {
  const fetchFn = deps.fetchFn ?? fetch;
  const setCookie = deps.setCookie ?? ((cookie: string) => void (document.cookie = cookie));
  try {
    const response = await fetchFn(`/api/trees/${treeId}/support`, { method: 'POST', credentials: 'include' });
    if (!response.ok) return false;
  } catch {
    return false;
  }
  setCookie(actingTreeCookie(treeId));
  return true;
}
