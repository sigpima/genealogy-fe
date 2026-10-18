import { lastLoginLabel } from '../admin/users';
import type { PlatformTree } from './trees';

export const statusLabel = (status: string): string => (status === 'paused' ? 'Đã tạm ngưng' : 'Đang hoạt động');

export function lastActivityLabel(iso: string | null, now: Date): string {
  return iso === null ? 'Chưa có hoạt động' : lastLoginLabel(iso, now);
}

/** Delete is only for a paused family and needs its slug typed back (surrounding spaces are forgiven, case is not). */
export function canDelete(tree: Pick<PlatformTree, 'status' | 'slug'>, typed: string): boolean {
  return tree.status === 'paused' && typed.trim() !== '' && typed.trim() === tree.slug;
}

export function deleteSummary(tree: Pick<PlatformTree, 'member_count' | 'user_count'>): string {
  return `${tree.member_count} người trong cây, ${tree.user_count} tài khoản, cùng toàn bộ ảnh, tài liệu, bài viết, thiệp mời và nhật ký của họ này.`;
}

/** `?loc=` from the to-do box: families without an active admin (paused ones excluded) or the paused ones. */
export function filterTrees(trees: PlatformTree[], loc: string | null): PlatformTree[] {
  if (loc === 'tam-ngung') return trees.filter((t) => t.status === 'paused');
  if (loc === 'khong-admin') return trees.filter((t) => t.status !== 'paused' && !t.admins.some((a) => a.status === 'active'));
  return trees;
}
