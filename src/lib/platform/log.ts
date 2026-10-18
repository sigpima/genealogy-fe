export type PlatformEvent = {
  id: number;
  action: string;
  actor_name: string;
  tree_id: number | null;
  tree_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const LABELS: Record<string, string> = {
  'tree.create': 'Tạo họ',
  'tree.update': 'Đổi tên/đường dẫn họ',
  'tree.pause': 'Tạm ngưng họ',
  'tree.resume': 'Kích hoạt lại họ',
  'tree.delete': 'Xoá họ',
  'admin.create': 'Thêm quản trị viên',
  'admin.promote': 'Nâng lên quản trị viên',
  'admin.update': 'Đổi trạng thái quản trị viên',
  'admin.password_reset': 'Đặt mật khẩu mới cho quản trị viên',
  'support.enter': 'Vào họ để hỗ trợ',
};
export const platformActionLabel = (action: string): string => LABELS[action] ?? action;

const FIELD: Record<string, string> = { name: 'Tên', slug: 'Đường dẫn', status: 'Trạng thái', role: 'Vai trò' };

/** One short line of the interesting details (never anything secret: the API never stores it). */
export function eventDetail(event: PlatformEvent): string {
  const d = event.details ?? {};
  const parts: string[] = [];
  if (typeof d.email === 'string') parts.push(d.email);
  if (d.changes && typeof d.changes === 'object') {
    parts.push(
      Object.entries(d.changes as Record<string, [unknown, unknown]>)
        .map(([k, [from, to]]) => `${FIELD[k] ?? k}: ${String(from)} → ${String(to)}`)
        .join(', '),
    );
  }
  if (event.action === 'tree.delete') {
    const counts = `${d.members ?? 0} người, ${d.users ?? 0} tài khoản, ${d.files ?? 0} file`;
    return [typeof d.slug === 'string' ? d.slug : null, counts].filter(Boolean).join(' · ');
  }
  return parts.filter(Boolean).join(' · ');
}

export type EventFilters = { action?: string; treeId?: number | null; since?: string; until?: string };

export function buildEventsQuery(filters: EventFilters, offset: number, limit = 50): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.action) params.set('action', filters.action);
  if (filters.treeId != null) params.set('tree_id', String(filters.treeId));
  if (filters.since) params.set('since', filters.since);
  if (filters.until) params.set('until', filters.until);
  return params.toString();
}
