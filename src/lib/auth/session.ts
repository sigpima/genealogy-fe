export type Role = 'superadmin' | 'admin' | 'member';
export type AccountStatus = 'pending' | 'active' | 'disabled';

export type CurrentUser = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  status: AccountStatus;
  /** The one family tree the user belongs to; null for a superadmin (platform level). */
  tree_id: number | null;
  tree_name: string | null;
};

export type SiteInfo = {
  visibility: 'private' | 'public';
  registration: 'open' | 'approval' | 'closed';
  tree_name?: string | null;
  tree_slug?: string | null;
};

/** Admins (of their tree) and the superadmin manage; members and guests only read. The API enforces it too. */
export function canManage(user: CurrentUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

/** Editing the tree needs the same permission as managing it. */
export function canEdit(user: CurrentUser | null): boolean {
  return canManage(user);
}

const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Quản trị tối cao',
  admin: 'Quản trị viên',
  member: 'Thành viên',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export const TOO_MANY_ATTEMPTS = 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.';

export function loginErrorMessage(
  status: number,
  detail: string | undefined,
): string {
  if (status === 429) return TOO_MANY_ATTEMPTS;
  if (status === 401) return 'Email hoặc mật khẩu không đúng.';
  if (status === 403 && detail === 'tree_paused') {
    return 'Họ của bạn đang tạm ngưng. Hãy liên hệ người quản lý hệ thống.';
  }
  if (status === 403 && detail === 'account_pending') {
    return 'Tài khoản của bạn đang chờ quản trị viên duyệt. Vui lòng quay lại sau.';
  }
  if (status === 403 && detail === 'account_disabled') {
    return 'Tài khoản của bạn đã bị vô hiệu hoá. Hãy liên hệ quản trị viên.';
  }
  return 'Không thể đăng nhập lúc này. Vui lòng thử lại.';
}

export function signupNotice(info: SiteInfo | null): string | null {
  if (!info) return null;
  if (info.registration === 'closed') {
    return 'Đăng ký tài khoản đang đóng. Hãy nhờ quản trị viên tạo tài khoản cho bạn.';
  }
  if (info.registration === 'approval') {
    return 'Tài khoản mới cần quản trị viên duyệt trước khi đăng nhập được.';
  }
  return null;
}

export function signupResultMessage(status: AccountStatus): string | null {
  return status === 'pending'
    ? 'Đăng ký thành công. Tài khoản của bạn đang chờ quản trị viên duyệt — bạn sẽ đăng nhập được sau khi được duyệt.'
    : null;
}
