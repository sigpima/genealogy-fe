/** "A, B\nC" -> ["A","B","C"]: names separated by new lines, commas or semicolons; blanks dropped. */
export function parseSplitNames(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export const SPLIT_MIN = 2;
export const SPLIT_MAX = 50;

export function splitError(names: string[]): string | null {
  if (names.length < SPLIT_MIN) return `Nhập ít nhất ${SPLIT_MIN} tên (mỗi tên một dòng).`;
  if (names.length > SPLIT_MAX) return `Tối đa ${SPLIT_MAX} tên.`;
  return null;
}

/** Suggest names for "Nguyễn Vô Danh 3 Vị": "<base> 1".."<base> N" (base = text before the number). */
export function suggestSplitNames(fullName: string): string {
  const match = fullName.match(/^(.*?)\s*(\d{1,2})\s*(?:vị|người|ông|bà)?\s*$/i);
  if (!match) return '';
  const count = Number(match[2]);
  if (count < SPLIT_MIN || count > SPLIT_MAX) return '';
  const base = match[1].trim();
  return Array.from({ length: count }, (_, i) => `${base} ${i + 1}`).join('\n');
}
