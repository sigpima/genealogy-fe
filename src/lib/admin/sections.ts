// The areas of the admin console. Registering a new area = adding it here (and giving its page `ready: true`
// only once it exists, so the home never shows a tile that leads nowhere).

export type AdminIcon = 'users' | 'settings' | 'privacy' | 'audit' | 'shares' | 'health' | 'backup' | 'publish';

export type AdminSection = {
  id: string;
  href: string;
  label: string;
  hint: string;
  icon: AdminIcon;
  ready: boolean;
};

export const SECTIONS: AdminSection[] = [
  { id: 'users', href: '/admin/nguoi-dung', label: 'Người dùng', hint: 'Duyệt đăng ký, vai trò, mật khẩu', icon: 'users', ready: true },
  { id: 'settings', href: '/admin/cai-dat', label: 'Cài đặt họ', hint: 'Công khai hay riêng tư, cách đăng ký', icon: 'settings', ready: true },
  { id: 'privacy', href: '/admin/rieng-tu', label: 'Quyền riêng tư', hint: 'Ai được xem từng thông tin', icon: 'privacy', ready: true },
  { id: 'audit', href: '/admin/nhat-ky', label: 'Nhật ký', hint: 'Ai đã đổi gì, sự kiện bảo mật', icon: 'audit', ready: false },
  { id: 'shares', href: '/admin/link', label: 'Link chia sẻ', hint: 'Link lịch và thiệp đang mở', icon: 'shares', ready: false },
  { id: 'health', href: '/admin/suc-khoe-du-lieu', label: 'Sức khoẻ dữ liệu', hint: 'Số liệu trùng hoặc vô lý', icon: 'health', ready: false },
  { id: 'backup', href: '/admin/sao-luu', label: 'Sao lưu', hint: 'Bản sao lưu gần nhất', icon: 'backup', ready: false },
  { id: 'publish', href: '/xuat-ban', label: 'Xuất bản', hint: 'Quyển phả PDF, dữ liệu JSON', icon: 'publish', ready: true },
];

export function visibleSections(): AdminSection[] {
  return SECTIONS.filter((s) => s.ready);
}

/** One line of the admin's "Cần làm" box, as `GET /api/admin/overview` returns it. */
export type TodoItem = { key: string; count: number; text: string; href: string; kind: 'task' | 'notice' };
export type Overview = { items: TodoItem[]; counts: Record<string, number> };

/** The to-do key that puts a count badge on a section's tile. */
export const BADGE_KEY: Record<string, string> = { users: 'pending_users' };
