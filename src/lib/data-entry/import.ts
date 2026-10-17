import type { ImportRowError } from './types';

/**
 * Per-row problems from a rejected import (422 with `{detail: {errors: [{row, message}]}}`), or a single
 * generic error for any other failure shape.
 */
export function importErrorsFrom(status: number, body: unknown): { general: string | null; rows: ImportRowError[] } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === 'object' && Array.isArray((detail as { errors?: unknown }).errors)) {
    const rows = ((detail as { errors: unknown[] }).errors as ImportRowError[]).filter(
      (e) => e && typeof e.row === 'number' && typeof e.message === 'string'
    );
    return { general: null, rows };
  }
  if (status === 413) return { general: 'File quá lớn (tối đa 5 MB và 10.000 dòng).', rows: [] };
  if (status === 400 && typeof detail === 'string') return { general: 'File phải ở dạng UTF-8 (CSV).', rows: [] };
  return { general: 'Không thể nhập file. Vui lòng thử lại.', rows: [] };
}

export function summaryText(s: { created: number; updated: number; unchanged: number }): string {
  return `${s.updated} cập nhật · ${s.created} thêm mới · ${s.unchanged} không đổi`;
}
