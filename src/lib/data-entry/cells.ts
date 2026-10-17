import type { Gender } from '@/lib/tree/types';

export type CellKind = 'text' | 'requiredText' | 'year' | 'order' | 'gender';
export type CellResult = { ok: true; value: string | number | null } | { ok: false; error: string };

const GENDERS: Gender[] = ['male', 'female', 'other'];

/** Turn what was typed into a cell into the value to PATCH (blank -> null), or say why it cannot be. */
export function parseCell(kind: CellKind, raw: string): CellResult {
  const text = raw.trim();
  switch (kind) {
    case 'requiredText':
      return text ? { ok: true, value: text } : { ok: false, error: 'Họ tên không được để trống.' };
    case 'text':
      return { ok: true, value: text || null };
    case 'year': {
      if (!text) return { ok: true, value: null };
      const year = Number(text);
      if (!Number.isInteger(year) || year < 1 || year > 9999) return { ok: false, error: 'Năm không hợp lệ.' };
      return { ok: true, value: year };
    }
    case 'order': {
      if (!text) return { ok: true, value: null };
      const order = Number(text);
      if (!Number.isInteger(order) || order < 1 || order > 99) return { ok: false, error: 'Thứ tự phải là số từ 1.' };
      return { ok: true, value: order };
    }
    case 'gender':
      if (!text) return { ok: true, value: null };
      return (GENDERS as string[]).includes(text) ? { ok: true, value: text } : { ok: false, error: 'Giới tính không hợp lệ.' };
  }
}

export function cellText(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** What to tell the user when a PATCH is refused. */
export function patchErrorMessage(status: number): string {
  if (status === 422) return 'Giá trị chưa hợp lệ (kiểm tra năm sinh/mất, tên...).';
  if (status === 404) return 'Không tìm thấy thành viên (có thể đã bị xoá). Hãy tải lại.';
  if (status === 401 || status === 403) return 'Bạn không có quyền sửa.';
  return 'Không thể lưu. Vui lòng thử lại.';
}
