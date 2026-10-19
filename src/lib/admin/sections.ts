// The areas of the admin console. Registering a new area = adding it here (and giving its page `ready: true`
// only once it exists, so the home never shows a tile that leads nowhere).

export type AdminIcon = 'families' | 'users' | 'settings' | 'privacy' | 'audit' | 'shares' | 'health' | 'backup' | 'publish';

export type AdminSection = {
  id: string;
  href: string;
  label: string;
  hint: string;
  icon: AdminIcon;
  ready: boolean;
};

export const SECTIONS: AdminSection[] = [
  { id: 'users', href: '/admin/nguoi-dung', label: 'Người dùng', hint: 'Tài khoản, vai trò, mật khẩu, link mời', icon: 'users', ready: true },
  { id: 'settings', href: '/admin/cai-dat', label: 'Cài đặt họ', hint: 'Công khai hay riêng tư', icon: 'settings', ready: true },
  { id: 'privacy', href: '/admin/rieng-tu', label: 'Quyền riêng tư', hint: 'Ai được xem từng thông tin', icon: 'privacy', ready: true },
  { id: 'shares', href: '/admin/link', label: 'Link lịch & thiệp mời', hint: 'Link lịch điện thoại và thiệp đang mở', icon: 'shares', ready: true },
  { id: 'health', href: '/admin/suc-khoe-du-lieu', label: 'Sức khoẻ dữ liệu', hint: 'Số liệu trùng hoặc vô lý', icon: 'health', ready: true },
];

export function visibleSections(): AdminSection[] {
  return SECTIONS.filter((s) => s.ready);
}

/** One line of the admin's "Cần làm" box, as `GET /api/admin/overview` returns it. */
export type TodoItem = { key: string; count: number; text: string; href: string; kind: 'task' | 'notice' };
export type Overview = { items: TodoItem[]; counts: Record<string, number> };

/** The to-do key that puts a count badge on a section's tile. */
export const BADGE_KEY: Record<string, string> = { health: 'data_issues' };
