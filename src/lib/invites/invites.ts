import { TOO_MANY_ATTEMPTS } from '../auth/session';

export type InviteStatus = 'pending' | 'used' | 'expired' | 'revoked';

export type Invitation = {
  id: number;
  member: { id: number; name: string };
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_email: string | null;
};

export type InviteCreated = { id: number; path: string; expires_at: string };
export type InvitePreview = { family: string; person: string; expires_at: string };

/** The link to hand over: this site's address plus the path the API returned (it carries the token, shown only once). */
export function inviteUrl(path: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}${path}`;
}

const STATUS_LABELS: Record<InviteStatus, string> = {
  pending: 'Đang chờ',
  used: 'Đã dùng',
  expired: 'Hết hạn',
  revoked: 'Đã thu hồi',
};

export function inviteStatusLabel(status: InviteStatus): string {
  return STATUS_LABELS[status];
}

export function tokenFromPath(path: string): string | null {
  const match = /^\/moi\/([^/]+)\/?$/.exec(path);
  return match ? match[1] : null;
}

type MiniStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Opening the app as a linked person focuses the tree on them — once per browser session, not on every visit to the home page. Never throws. */
export function shouldFocusMe(storage: MiniStorage | null, memberId: number): boolean {
  if (!storage) return false;
  const key = `genealogy.focused-me.${memberId}`;
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

const GONE = 'Lời mời không còn hiệu lực. Hãy nhờ người quản trị gửi lại link mới.';

export function inviteErrorMessage(status: number): string {
  if (status === 404) return GONE;
  if (status === 429) return TOO_MANY_ATTEMPTS;
  return 'Không thể mở lời mời lúc này. Vui lòng thử lại.';
}

export function acceptErrorMessage(status: number, detail: string | undefined): string {
  if (status === 404) return GONE;
  if (status === 409 && detail?.includes('already has an account')) return 'Người này đã có tài khoản. Hãy đăng nhập bằng tài khoản đó.';
  if (status === 409) return 'Email này đã được dùng cho một tài khoản khác. Hãy dùng email khác.';
  if (status === 422) return 'Hãy kiểm tra lại email và đặt mật khẩu từ 8 ký tự trở lên.';
  if (status === 429) return TOO_MANY_ATTEMPTS;
  return 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.';
}

export async function createInvitation(memberId: number): Promise<{ ok: true; invite: InviteCreated } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/members/${memberId}/invitation`, { method: 'POST', credentials: 'include' });
    if (response.status === 409) return { ok: false, error: 'Người này đã có tài khoản, không cần mời nữa.' };
    if (!response.ok) return { ok: false, error: 'Không tạo được link mời. Vui lòng thử lại.' };
    return { ok: true, invite: (await response.json()) as InviteCreated };
  } catch {
    return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
  }
}
