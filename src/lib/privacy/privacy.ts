export type PrivacyLevel = 'admin' | 'member' | 'public';
export type PrivacyFields = Record<string, PrivacyLevel>;

export const LEVELS: { value: PrivacyLevel; label: string }[] = [
  { value: 'admin', label: 'Chỉ quản trị viên' },
  { value: 'member', label: 'Thành viên đã đăng nhập' },
  { value: 'public', label: 'Công khai (cả khách)' },
];

/** The fields an admin can place, in the order they are shown. Keys match the API. */
export const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'phone', label: 'Số điện thoại', hint: 'Trong hồ sơ từng người.' },
  { key: 'email', label: 'Email', hint: 'Trong hồ sơ từng người.' },
  { key: 'residence', label: 'Nơi ở hiện tại', hint: '' },
  { key: 'hometown', label: 'Quê quán', hint: 'Cũng dùng khi lọc và tìm kiếm.' },
  { key: 'notes', label: 'Ghi chú / tiểu sử', hint: 'Gồm cả ghi chú về vợ/chồng.' },
  { key: 'burial', label: 'Nơi an nghỉ', hint: 'Địa điểm, khu mộ, toạ độ.' },
  { key: 'avatar', label: 'Ảnh chân dung', hint: 'Cả đường dẫn tới file ảnh.' },
];

/** Only what differs from `saved`, so the PUT carries exactly the edited fields. */
export function changedLevels(saved: PrivacyFields, edited: PrivacyFields): PrivacyFields {
  const changed: PrivacyFields = {};
  for (const [key, level] of Object.entries(edited)) if (saved[key] !== level) changed[key] = level;
  return changed;
}

/** "Công khai" only means something to guests of a public tree: warn when a field is public but the tree is private. */
export function publicNeedsPublicTree(fields: PrivacyFields, visibility: 'private' | 'public' | null): string | null {
  if (visibility === 'public') return null;
  const open = FIELDS.filter((f) => fields[f.key] === 'public').map((f) => f.label.toLowerCase());
  if (open.length === 0) return null;
  return `Mức "Công khai" của ${open.join(', ')} chỉ có tác dụng khi gia phả ở chế độ công khai (tab Cài đặt); hiện tại cây đang riêng tư nên chỉ thành viên xem được.`;
}
