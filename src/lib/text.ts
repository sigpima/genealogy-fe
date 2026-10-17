/**
 * Search key: no tone marks or diacritics (`đ` -> `d`), lower case, single spaces. Mirrors `fold()` in
 * genealogy-api (`app/core/text.py`) so the browser and the server agree on what "the same name" means.
 * NFD splits each letter into base + combining marks, so `hòa`, `hoà` and `hoa` all fold to `hoa`.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
