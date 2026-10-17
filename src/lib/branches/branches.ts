import type { FamilyMember } from '@/lib/tree/types';

/** A chi/phái as `GET /api/branches` returns it: the subtree below `root_member_id`. */
export type Branch = {
  id: number;
  name: string;
  color: string;
  description: string | null;
  root_member_id: number;
  root_name: string;
  root_generation: number;
  /** Everyone below the head, the head and sub-branches included. */
  member_count: number;
};

/** A member's branch as shown on the profile and in search results. */
export type BranchRef = { id: number; name: string; color: string };

/**
 * member id -> its branch: the DEEPEST branch whose head is the member or one of their ancestors (so a
 * sub-branch overrides its parent branch). Members under no branch are absent. Mirrors the API.
 */
export function assignBranches(root: FamilyMember, branches: Branch[]): Map<number, Branch> {
  const byHead = new Map(branches.map((b) => [b.root_member_id, b]));
  const result = new Map<number, Branch>();
  if (byHead.size === 0) return result;
  const stack: { node: FamilyMember; branch: Branch | null }[] = [{ node: root, branch: null }];
  while (stack.length > 0) {
    const { node, branch: inherited } = stack.pop()!;
    const branch = (node.id !== undefined ? byHead.get(node.id) : undefined) ?? inherited;
    if (branch && node.id !== undefined) result.set(node.id, branch);
    for (const child of node.children ?? []) stack.push({ node: child, branch });
  }
  return result;
}

/** Branches in the order a reader expects them: by the head's generation, then creation order. */
export function sortBranches(branches: Branch[]): Branch[] {
  return [...branches].sort((a, b) => a.root_generation - b.root_generation || a.id - b.id);
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function branchErrorMessage(status: number, detail: unknown): string {
  const text = typeof detail === 'string' ? detail : '';
  if (status === 409) return 'Người này đã là trưởng của một chi khác.';
  if (status === 404) return 'Không tìm thấy người hoặc chi này (có thể đã bị xoá).';
  if (status === 422) return 'Thông tin chưa hợp lệ: kiểm tra tên chi và màu (dạng #rrggbb).';
  if (status === 401 || status === 403) return 'Bạn không có quyền sửa chi phái.';
  return text ? 'Không thể lưu. Vui lòng thử lại.' : 'Không thể lưu. Vui lòng thử lại.';
}
