export type FamilyAdmin = { id: number; email: string; full_name: string; status: 'active' | 'disabled' | 'pending'; last_login_at: string | null };
export type FamilyUser = { id: number; email: string; full_name: string; role: string; status: string };

const LABELS: Record<FamilyAdmin['status'], string> = { active: 'Đang hoạt động', disabled: 'Đã vô hiệu hoá', pending: 'Chờ duyệt' };
export const adminStatusLabel = (status: FamilyAdmin['status']): string => LABELS[status];

/** The API refuses to leave a family without an active admin; the dialog hides the button instead of letting you hit that. */
export function canDisable(admins: FamilyAdmin[], target: FamilyAdmin): boolean {
  if (target.status !== 'active') return true;
  return admins.some((a) => a.id !== target.id && a.status === 'active');
}

/** Users of the family who could become admins, in name order (accents folded by the browser's collation). */
export function promotable(users: FamilyUser[]): FamilyUser[] {
  return users.filter((u) => u.role !== 'admin').sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
}
