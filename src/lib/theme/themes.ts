export type ThemeId = 'heritage' | 'warm' | 'modern' | 'elegant';

export type ThemeOption = {
  id: ThemeId;
  label: string;
  swatch: { bg: string; primary: string };
};

export const THEMES: ThemeOption[] = [
  { id: 'heritage', label: 'Di sản', swatch: { bg: '#F9F6F0', primary: '#8B2635' } },
  { id: 'warm', label: 'Ấm / truyền thống', swatch: { bg: '#FBF7F2', primary: '#B85A34' } },
  { id: 'modern', label: 'Hiện đại tối giản', swatch: { bg: '#F8FAFC', primary: '#2563EB' } },
  { id: 'elegant', label: 'Sang trọng tối màu', swatch: { bg: '#14110F', primary: '#D4AF37' } },
];

export const DEFAULT_THEME: ThemeId = 'heritage';

export function isThemeId(value: string | null): value is ThemeId {
  return value === 'heritage' || value === 'warm' || value === 'modern' || value === 'elegant';
}
