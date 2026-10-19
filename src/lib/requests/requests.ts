import type { Gender, MemberDetail, PanelProfile } from '@/lib/tree/types';

export type RequestKind = 'edit' | 'add_child' | 'report';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type DiffRow = { field: string; old: unknown; new: unknown; stale: boolean };

/** One request as `GET /api/requests` returns it. */
export type ChangeRequest = {
  id: number;
  kind: RequestKind;
  status: RequestStatus;
  member_id: number | null;
  member_name: string | null;
  message: string | null;
  changes: Record<string, unknown>;
  base: Record<string, unknown>;
  diff: DiffRow[];
  /** Pending only: the person changed since the request was sent. */
  stale: boolean;
  requester: { id: number | null; name: string };
  reviewer: { id: number | null; name: string } | null;
  review_note: string | null;
  result_member_id: number | null;
  created_at: string;
  reviewed_at: string | null;
};

export type RequestPage = { total: number; items: ChangeRequest[] };

export type AuditEntry = {
  id: number;
  action: string;
  actor_id: number | null;
  actor_name: string;
  /** "superadmin" = the platform owner acting inside this family; null when the account is gone. */
  actor_role?: string | null;
  member_id: number | null;
  member_name: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  details: Record<string, unknown> | null;
  request_id: number | null;
  created_at: string;
};

export type AuditPage = { total: number; items: AuditEntry[] };

export const FIELD_LABELS: Record<string, string> = {
  full_name: 'Họ tên',
  gender: 'Giới tính',
  birth_year: 'Năm sinh',
  birth_month: 'Tháng sinh',
  birth_day: 'Ngày sinh',
  birth_is_lunar: 'Ngày sinh theo âm lịch',
  birth_leap_month: 'Sinh vào tháng nhuận',
  death_year: 'Năm mất',
  death_month: 'Tháng mất',
  death_day: 'Ngày mất',
  death_is_lunar: 'Ngày mất theo âm lịch',
  death_leap_month: 'Mất vào tháng nhuận',
  courtesy_name: 'Tên tự',
  title: 'Chức vị',
  hometown: 'Quê quán',
  residence: 'Nơi ở',
  phone: 'Điện thoại',
  email: 'Email',
  burial_place: 'Mộ phần',
  burial_latitude: 'Vĩ độ mộ',
  burial_longitude: 'Kinh độ mộ',
  burial_map_url: 'Link bản đồ mộ',
  notes: 'Ghi chú',
  birth_order: 'Con thứ',
  is_adopted: 'Con nuôi',
  parent_id: 'Cha',
  mother_id: 'Mẹ',
  avatar_url: 'Ảnh đại diện',
  marriage_year: 'Năm cưới',
  spouse_full_name: 'Tên vợ/chồng',
  spouse_birth_year: 'Năm sinh vợ/chồng',
  spouse_death_year: 'Năm mất vợ/chồng',
  spouse_gender: 'Giới tính vợ/chồng',
  spouse_notes: 'Ghi chú vợ/chồng',
  name: 'Tên chi',
  color: 'Màu',
  description: 'Mô tả',
  root_member_id: 'Trưởng chi',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

const GENDER_TEXT: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };

/** A value as a reader wants to see it in a before/after table. */
export function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '(trống)';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (field === 'gender' || field === 'spouse_gender') return GENDER_TEXT[String(value)] ?? String(value);
  if (field === 'avatar_url') return 'ảnh';
  return String(value);
}

const STATUS_TEXT: Record<RequestStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  cancelled: 'Đã rút lại',
};
const KIND_TEXT: Record<RequestKind, string> = {
  edit: 'Đề xuất sửa',
  add_child: 'Đề xuất thêm con',
  report: 'Báo sai / bổ sung',
};

export const statusLabel = (status: RequestStatus): string => STATUS_TEXT[status];
export const kindLabel = (kind: RequestKind): string => KIND_TEXT[kind];

const ACTION_TEXT: Record<string, string> = {
  'member.create': 'Thêm người',
  'member.update': 'Sửa thông tin',
  'member.delete': 'Xoá người',
  'member.split': 'Tách một dòng thành nhiều người',
  'member.avatar': 'Đổi ảnh đại diện',
  'marriage.create': 'Thêm vợ/chồng',
  'marriage.update': 'Sửa vợ/chồng',
  'branch.create': 'Tạo chi',
  'branch.update': 'Sửa chi',
  'branch.delete': 'Xoá chi',
  'request.approve': 'Duyệt yêu cầu',
  'request.reject': 'Từ chối yêu cầu',
  'article.create': 'Đăng bài sử ký',
  'article.update': 'Sửa bài sử ký',
  'article.delete': 'Xoá bài sử ký',
  'timeline.create': 'Thêm mốc thời gian',
  'timeline.update': 'Sửa mốc thời gian',
  'timeline.delete': 'Xoá mốc thời gian',
  'poem.update': 'Sửa bài đệm',
  'event.create': 'Thêm sự kiện',
  'event.update': 'Sửa sự kiện',
  'event.delete': 'Xoá sự kiện',
  'card.create': 'Tạo thiệp mời',
  'card.update': 'Sửa thiệp mời',
  'card.delete': 'Xoá thiệp mời',
  'place.create': 'Thêm địa điểm',
  'place.update': 'Sửa địa điểm',
  'place.delete': 'Xoá địa điểm',
  'place.migrate': 'Gom nơi an nghỉ cũ thành địa điểm',
  'media.upload': 'Tải ảnh/tài liệu lên',
  'media.update': 'Sửa chú thích ảnh/tài liệu',
  'media.delete': 'Xoá ảnh/tài liệu',
  'user.create': 'Tạo tài khoản',
  'user.update': 'Sửa tài khoản',
  'invite.create': 'Tạo link mời',
  'invite.revoke': 'Thu hồi link mời',
  'invite.accept': 'Nhận lời mời, tạo tài khoản',
  'user.approve': 'Duyệt tài khoản',
  'user.password_reset': 'Đặt lại mật khẩu',
  'security.login_failed': 'Đăng nhập sai',
  'security.locked': 'Tài khoản bị khoá tạm vì đăng nhập sai nhiều lần',
  'settings.update': 'Đổi cài đặt họ',
  'calendar.enable': 'Bật link lịch điện thoại',
  'calendar.regenerate': 'Tạo link lịch mới (link cũ ngừng hoạt động)',
  'calendar.disable': 'Tắt link lịch điện thoại',
  'privacy.update': 'Đổi quyền riêng tư',
  'data.export': 'Tải dữ liệu JSON',
  'book.export': 'Xuất quyển phả PDF',
};

export function actionLabel(action: string): string {
  return ACTION_TEXT[action] ?? action;
}

/** The changed fields of an audit entry as "Năm sinh: 1930 → 1931" lines. */
export function changeLines(changes: AuditEntry['changes']): string[] {
  if (!changes) return [];
  return Object.entries(changes).map(
    ([field, [from, to]]) => `${fieldLabel(field)}: ${formatFieldValue(field, from)} → ${formatFieldValue(field, to)}`,
  );
}

export function requestErrorMessage(status: number, detail: unknown): string {
  const text = typeof detail === 'string' ? detail : '';
  if (status === 409 && /no longer exists/.test(text)) return 'Người này đã bị xoá nên không áp dụng được. Hãy từ chối yêu cầu.';
  if (status === 409 && /no longer fits/.test(text)) return 'Dữ liệu hiện tại không còn khớp với đề xuất này. Hãy từ chối và nhờ gửi lại.';
  if (status === 409) return 'Yêu cầu này đã được xử lý rồi.';
  if (status === 404) return 'Không tìm thấy yêu cầu (có thể đã bị xoá).';
  if (status === 422) return text && !/^\[/.test(text) ? translateRefusal(text) : 'Thông tin chưa hợp lệ: kiểm tra ngày tháng, điện thoại, email.';
  if (status === 401 || status === 403) return 'Bạn không có quyền thực hiện việc này.';
  return 'Không thể thực hiện. Vui lòng thử lại.';
}

function translateRefusal(text: string): string {
  if (/changes nothing|nothing was proposed/.test(text)) return 'Bạn chưa thay đổi gì so với thông tin hiện có.';
  if (/needs a name/.test(text)) return 'Hãy nhập tên người con.';
  if (/describe what is wrong/.test(text)) return 'Hãy mô tả điều cần sửa (ít nhất 5 ký tự).';
  if (/give a reason/.test(text)) return 'Hãy ghi lý do từ chối.';
  return 'Thông tin chưa hợp lệ.';
}

// ---------------------------------------------------------------------------------------------------
// The "propose an edit" form: a flat bag of strings/booleans that is compared with the person's current data.

export type ProposeForm = {
  full_name: string;
  gender: '' | Gender;
  birth_year: string;
  birth_month: string;
  birth_day: string;
  birth_is_lunar: boolean;
  birth_leap_month: boolean;
  death_year: string;
  death_month: string;
  death_day: string;
  death_is_lunar: boolean;
  death_leap_month: boolean;
  hometown: string;
  residence: string;
  courtesy_name: string;
  title: string;
  phone: string;
  email: string;
  burial_place: string;
  notes: string;
  birth_order: string;
  is_adopted: boolean;
};

const TEXT_FIELDS = ['full_name', 'hometown', 'residence', 'courtesy_name', 'title', 'phone', 'email', 'burial_place', 'notes'] as const;
const NUMBER_FIELDS: Record<string, [number, number]> = {
  birth_year: [1, 9999],
  birth_month: [1, 12],
  birth_day: [1, 31],
  death_year: [1, 9999],
  death_month: [1, 12],
  death_day: [1, 31],
  birth_order: [1, 99],
};
const BOOLEAN_FIELDS = ['birth_is_lunar', 'birth_leap_month', 'death_is_lunar', 'death_leap_month', 'is_adopted'] as const;

const text = (value: string | null | undefined) => value ?? '';
const num = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

/** The form pre-filled from a member's detail (what the API returned) and name. */
export function formFromDetail(name: string, detail: MemberDetail): ProposeForm {
  return {
    full_name: name,
    gender: detail.gender ?? '',
    birth_year: num(detail.birth_year),
    birth_month: num(detail.birth_month),
    birth_day: num(detail.birth_day),
    birth_is_lunar: detail.birth_is_lunar,
    birth_leap_month: detail.birth_leap_month,
    death_year: num(detail.death_year),
    death_month: num(detail.death_month),
    death_day: num(detail.death_day),
    death_is_lunar: detail.death_is_lunar,
    death_leap_month: detail.death_leap_month,
    hometown: text(detail.hometown),
    residence: text(detail.residence),
    courtesy_name: text(detail.courtesy_name),
    title: text(detail.title),
    phone: text(detail.phone),
    email: text(detail.email),
    burial_place: text(detail.burial_place),
    notes: text(detail.notes),
    birth_order: num(detail.birth_order),
    is_adopted: detail.is_adopted,
  };
}

export type ChangesResult = { ok: true; changes: Record<string, unknown> } | { ok: false; error: string };

/** Only the fields that differ from `original`, typed for the API (blank -> null). */
export function changesFromForm(original: ProposeForm, draft: ProposeForm): ChangesResult {
  const changes: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    const next = draft[field].trim();
    if (next !== original[field].trim()) {
      if (field === 'full_name' && !next) return { ok: false, error: 'Họ tên không được để trống.' };
      changes[field] = next === '' ? null : next;
    }
  }
  if (draft.gender !== original.gender) changes.gender = draft.gender === '' ? null : draft.gender;
  for (const [field, [min, max]] of Object.entries(NUMBER_FIELDS)) {
    const key = field as keyof ProposeForm;
    const raw = String(draft[key]).trim();
    if (raw === String(original[key]).trim()) continue;
    if (raw === '') {
      changes[field] = null;
      continue;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) return { ok: false, error: `${fieldLabel(field)} phải là số từ ${min} đến ${max}.` };
    changes[field] = value;
  }
  for (const field of BOOLEAN_FIELDS) {
    if (draft[field] !== original[field]) changes[field] = draft[field];
  }
  return { ok: true, changes };
}

/** A new child: a name plus whatever the sender knows. */
export function childChanges(name: string, gender: '' | Gender, birthYear: string): ChangesResult {
  if (!name.trim()) return { ok: false, error: 'Hãy nhập tên người con.' };
  const changes: Record<string, unknown> = { full_name: name.trim() };
  if (gender) changes.gender = gender;
  if (birthYear.trim()) {
    const year = Number(birthYear);
    if (!Number.isInteger(year) || year < 1 || year > 9999) return { ok: false, error: 'Năm sinh phải là số từ 1 đến 9999.' };
    changes.birth_year = year;
  }
  return { ok: true, changes };
}

/** The same form pre-filled from what the detail panel already holds (it has the person's fields in camelCase). */
export function formFromPanel(
  name: string,
  person: { birthYear: number | null; deathYear: number | null; gender: Gender | null; notes: string | null; profile: PanelProfile },
): ProposeForm {
  const { profile } = person;
  return {
    full_name: name,
    gender: person.gender ?? '',
    birth_year: num(person.birthYear),
    birth_month: num(profile.birthMonth),
    birth_day: num(profile.birthDay),
    birth_is_lunar: profile.birthIsLunar,
    birth_leap_month: profile.birthLeapMonth,
    death_year: num(person.deathYear),
    death_month: num(profile.deathMonth),
    death_day: num(profile.deathDay),
    death_is_lunar: profile.deathIsLunar,
    death_leap_month: profile.deathLeapMonth,
    hometown: text(profile.hometown),
    residence: text(profile.residence),
    courtesy_name: text(profile.courtesyName),
    title: text(profile.title),
    phone: text(profile.phone),
    email: text(profile.email),
    burial_place: text(profile.burialPlace),
    notes: text(person.notes),
    birth_order: num(profile.birthOrder),
    is_adopted: profile.isAdopted,
  };
}
