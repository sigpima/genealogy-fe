export type Role = 'admin' | 'member';
export type AccountStatus = 'pending' | 'active' | 'disabled';

export type CurrentUser = {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  status: AccountStatus;
};

export type SiteInfo = {
  visibility: 'private' | 'public';
  registration: 'open' | 'approval' | 'closed';
};

/** Only admins edit; members and guests read. (The API enforces the same rule.) */
export function canEdit(user: CurrentUser | null): boolean {
  return user?.role === 'admin';
}

export function roleLabel(role: Role): string {
  return role === 'admin' ? 'Quản trị viên' : 'Thành viên';
}

export function loginErrorMessage(
  status: number,
  detail: string | undefined,
): string {
  if (status === 401) return 'Email hoặc mật khẩu không đúng.';
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
