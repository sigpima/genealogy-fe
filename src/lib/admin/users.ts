import type { CurrentUser } from '../auth/session';

/** A user as `GET /api/admin/users` returns it. */
export type AdminUser = CurrentUser & {
  created_at: string;
  last_login_at: string | null;
  member: { id: number; name: string } | null;
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function vnDay(date: Date): number {
  return Math.floor((date.getTime() + VN_OFFSET_MS) / 86_400_000);
}

/** "Chưa ghi nhận", "Hôm nay", "Hôm qua", "N ngày trước" (up to a week), else dd/mm/yyyy — days counted in Vietnam time. */
export function lastLoginLabel(iso: string | null, now: Date): string {
  if (iso === null) return 'Chưa ghi nhận';
  const then = new Date(iso);
  const days = vnDay(now) - vnDay(then);
  if (days <= 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  if (days <= 7) return `${days} ngày trước`;
  const shifted = new Date(then.getTime() + VN_OFFSET_MS);
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${shifted.getUTCFullYear()}`;
}

export function buildUsersQuery(filters: { q: string; status: string; role: string }): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.role) params.set('role', filters.role);
  return params.toString();
}
