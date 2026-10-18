export type Finding = {
  kind: string;
  severity: 'warning' | 'info';
  member_id: number | null;
  member_name: string | null;
  message: string;
};

export type FindingGroup = { kind: string; label: string; hint: string; items: Finding[] };

const KINDS: { kind: string; label: string; hint: string }[] = [
  { kind: 'death_before_birth', label: 'Năm mất trước năm sinh', hint: 'Chắc chắn có một trong hai năm bị nhập nhầm.' },
  { kind: 'child_before_parent', label: 'Con sinh trước cha', hint: 'Kiểm tra năm sinh của con hoặc của cha, hoặc người đó có đúng là con không.' },
  { kind: 'parent_age_gap', label: 'Chênh lệch tuổi với cha quá ít hoặc quá nhiều', hint: 'Dưới 12 tuổi hoặc trên 70 tuổi giữa cha và con.' },
  { kind: 'duplicate_name_year', label: 'Có thể bị nhập trùng', hint: 'Cùng tên (không tính dấu) và cùng năm sinh.' },
  { kind: 'media_file_missing', label: 'Ảnh/tài liệu mất file trên máy chủ', hint: 'Có trong dữ liệu nhưng file không còn. Cần khôi phục từ bản sao lưu hoặc tải lên lại.' },
  { kind: 'ancestor_gap_undated', label: 'Chưa có năm sinh nhưng con cháu đã có', hint: 'Chỉ để tham khảo: bổ sung nếu biết.' },
  { kind: 'media_orphan', label: 'Ảnh/tài liệu không gắn với ai', hint: 'Chỉ để tham khảo: có thể xoá nếu không dùng.' },
];

/** Findings grouped by kind in the order the kinds matter (most certain problems first); unknown kinds keep their place at the end. */
export function groupFindings(findings: Finding[]): FindingGroup[] {
  const known = KINDS.map((k) => ({ ...k, items: findings.filter((f) => f.kind === k.kind) })).filter((g) => g.items.length > 0);
  const knownKinds = new Set(KINDS.map((k) => k.kind));
  const other = new Map<string, Finding[]>();
  for (const f of findings) if (!knownKinds.has(f.kind)) other.set(f.kind, [...(other.get(f.kind) ?? []), f]);
  return [...known, ...[...other].map(([kind, items]) => ({ kind, label: kind, hint: '', items }))];
}

export function healthHeadline(findings: Finding[]): string {
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const notes = findings.length - warnings;
  if (findings.length === 0) return 'Dữ liệu ổn: chưa thấy chỗ nào đáng ngờ.';
  const noteText = notes > 0 ? `${notes} ghi chú nhỏ` : '';
  if (warnings === 0) return `Không có chỗ nào sai rõ ràng, ${noteText}.`;
  return `${warnings} chỗ cần xem lại${noteText ? `, ${noteText}` : ''}.`;
}
