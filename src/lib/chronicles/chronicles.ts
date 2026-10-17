export type ArticleKind = 'origin' | 'lineage' | 'precepts' | 'event' | 'person' | 'other';
export type ArticleStatus = 'draft' | 'published';

export const ARTICLE_KIND_LABELS: Record<ArticleKind, string> = {
  origin: 'Nguồn gốc',
  lineage: 'Thế thứ',
  precepts: 'Tộc ước / gia huấn',
  event: 'Sự kiện',
  person: 'Nhân vật',
  other: 'Khác',
};

export type ArticleSummary = {
  id: number;
  title: string;
  slug: string;
  kind: ArticleKind;
  excerpt: string;
  status: ArticleStatus;
  pinned: boolean;
  position: number;
  cover_url: string | null;
  updated_at: string;
};

export type MemberName = { id: number; name: string };

export type Article = ArticleSummary & {
  body: string;
  cover_media_id: number | null;
  members: MemberName[];
  created_at: string;
};

export type TimelineEntry = {
  id: number;
  year: number;
  month: number | null;
  day: number | null;
  title: string;
  body: string | null;
  member_id: number | null;
  member_name: string | null;
  article_id: number | null;
};

export type GenerationWord = { generation: number; word: string; meaning: string | null };

const pad = (n: number) => String(n).padStart(2, '0');

/** "1820", "03/1820", "05/03/1820". */
export function formatTimelineDate(entry: Pick<TimelineEntry, 'year' | 'month' | 'day'>): string {
  if (entry.month === null) return String(entry.year);
  if (entry.day === null) return `${pad(entry.month)}/${entry.year}`;
  return `${pad(entry.day)}/${pad(entry.month)}/${entry.year}`;
}

/** Group sorted timeline entries by century/decade heading for a readable list ("Thế kỷ XIX"). */
export function centuryOf(year: number): number {
  return Math.floor((year - 1) / 100) + 1;
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function century(year: number): string {
  let n = centuryOf(year);
  let out = '';
  for (const [value, symbol] of ROMAN) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return `Thế kỷ ${out}`;
}

/** The bài đệm word for a generation, or null. */
export function wordFor(words: GenerationWord[], generation: number): GenerationWord | null {
  return words.find((w) => w.generation === generation) ?? null;
}

/** "Chữ đệm đời 5: Văn (nghĩa)" for the add-child hint. */
export function wordHint(words: GenerationWord[], generation: number): string | null {
  const found = wordFor(words, generation);
  if (!found) return null;
  return `Chữ đệm đời ${generation}: ${found.word}${found.meaning ? ` (${found.meaning})` : ''}`;
}

export type ArticleForm = {
  title: string;
  kind: ArticleKind;
  body: string;
  status: ArticleStatus;
  pinned: boolean;
  cover_media_id: number | null;
  member_ids: number[];
};

export const EMPTY_ARTICLE_FORM: ArticleForm = {
  title: '',
  kind: 'origin',
  body: '',
  status: 'draft',
  pinned: false,
  cover_media_id: null,
  member_ids: [],
};

export function articleToForm(article: Article): ArticleForm {
  return {
    title: article.title,
    kind: article.kind,
    body: article.body,
    status: article.status,
    pinned: article.pinned,
    cover_media_id: article.cover_media_id,
    member_ids: article.members.map((m) => m.id),
  };
}

export type FormResult<T> = { ok: true; payload: T } | { ok: false; error: string };

export function articlePayload(form: ArticleForm): FormResult<ArticleForm> {
  const title = form.title.trim();
  if (!title) return { ok: false, error: 'Hãy nhập tiêu đề.' };
  if (form.body.length > 100_000) return { ok: false, error: 'Bài viết quá dài (tối đa 100.000 ký tự).' };
  return { ok: true, payload: { ...form, title, member_ids: [...new Set(form.member_ids)] } };
}

export type TimelineForm = { year: string; month: string; day: string; title: string; body: string; member_id: number | null };

export const EMPTY_TIMELINE_FORM: TimelineForm = { year: '', month: '', day: '', title: '', body: '', member_id: null };

export function timelineToForm(entry: TimelineEntry): TimelineForm {
  return {
    year: String(entry.year),
    month: entry.month === null ? '' : String(entry.month),
    day: entry.day === null ? '' : String(entry.day),
    title: entry.title,
    body: entry.body ?? '',
    member_id: entry.member_id,
  };
}

export function timelinePayload(
  form: TimelineForm,
): FormResult<{ year: number; month: number | null; day: number | null; title: string; body: string | null; member_id: number | null }> {
  const title = form.title.trim();
  if (!title) return { ok: false, error: 'Hãy nhập nội dung sự kiện.' };
  const year = Number(form.year);
  if (!Number.isInteger(year) || year < 1 || year > 2200) return { ok: false, error: 'Năm phải là số từ 1 đến 2200.' };
  const month = form.month.trim() ? Number(form.month) : null;
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) return { ok: false, error: 'Tháng phải là số từ 1 đến 12.' };
  const day = form.day.trim() ? Number(form.day) : null;
  if (day !== null) {
    if (month === null) return { ok: false, error: 'Nhập tháng trước khi nhập ngày.' };
    if (!Number.isInteger(day) || day < 1 || day > 31 || new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1) {
      return { ok: false, error: 'Ngày này không tồn tại trong tháng.' };
    }
  }
  return { ok: true, payload: { year, month, day, title, body: form.body.trim() || null, member_id: form.member_id } };
}

export type WordRow = { generation: string; word: string; meaning: string };

export function wordsToRows(words: GenerationWord[]): WordRow[] {
  return words.map((w) => ({ generation: String(w.generation), word: w.word, meaning: w.meaning ?? '' }));
}

export function wordsPayload(rows: WordRow[]): FormResult<{ words: GenerationWord[] }> {
  const words: GenerationWord[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    if (!row.generation.trim() && !row.word.trim() && !row.meaning.trim()) continue; // a blank row is just unused space
    const generation = Number(row.generation);
    if (!Number.isInteger(generation) || generation < 1 || generation > 200) return { ok: false, error: 'Đời phải là số từ 1 đến 200.' };
    if (!row.word.trim()) return { ok: false, error: `Đời ${generation} chưa có chữ đệm.` };
    if (seen.has(generation)) return { ok: false, error: `Đời ${generation} xuất hiện hai lần.` };
    seen.add(generation);
    words.push({ generation, word: row.word.trim(), meaning: row.meaning.trim() || null });
  }
  return { ok: true, payload: { words: words.sort((a, b) => a.generation - b.generation) } };
}

export function chroniclesErrorMessage(status: number): string {
  if (status === 404) return 'Không tìm thấy (có thể đã bị xoá), hoặc một người được nhắc không thuộc họ này.';
  if (status === 422) return 'Thông tin chưa hợp lệ. Kiểm tra tiêu đề, ngày tháng và độ dài.';
  if (status === 401 || status === 403) return 'Chỉ quản trị viên mới sửa được.';
  return 'Không thể lưu. Vui lòng thử lại.';
}
