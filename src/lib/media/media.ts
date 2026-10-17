export type MediaItem = {
  id: number;
  kind: 'image' | 'document';
  original_name: string;
  content_type: string;
  size: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  member_id: number | null;
  place_id: number | null;
  url: string;
  thumb_url: string | null;
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',');

/** "1,2 MB" / "340 KB": what a reader wants next to a file name. */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** A problem with the file before sending it (the API checks again, by content), or null. */
export function uploadProblem(file: { name: string; type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `“${file.name}”: chỉ nhận ảnh JPEG, PNG, WebP hoặc file PDF.`;
  if (file.size === 0) return `“${file.name}” là file rỗng.`;
  if (file.size > MAX_UPLOAD_BYTES) return `“${file.name}” quá lớn (${formatSize(file.size)}; tối đa 10 MB).`;
  return null;
}

export function mediaErrorMessage(status: number, detail: unknown): string {
  const text = typeof detail === 'string' ? detail : '';
  if (status === 400 && /not a valid image|not a PDF|unsupported/.test(text)) return 'File không phải ảnh/PDF hợp lệ (hoặc bị hỏng).';
  if (status === 400 && /too large/.test(text)) return 'File quá lớn (tối đa 10 MB).';
  if (status === 400) return 'File không hợp lệ.';
  if (status === 404) return 'Không tìm thấy (có thể đã bị xoá).';
  if (status === 401 || status === 403) return 'Chỉ quản trị viên mới tải lên được.';
  return 'Không thể thực hiện. Vui lòng thử lại.';
}

/** The images of a list, in order, for the viewer's previous/next. */
export function imagesOf(items: MediaItem[]): MediaItem[] {
  return items.filter((item) => item.kind === 'image');
}

/** Index after pressing previous (-1) / next (+1), wrapping around. */
export function stepIndex(index: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return (index + delta + length) % length;
}
