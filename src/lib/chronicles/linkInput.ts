import { safeHref } from '../markdown/markdown';

/** What a person typed into "Chèn link" as an address the reader will accept (http, https, mailto, a site path), or null. */
export function normaliseLinkInput(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return safeHref(text); // has a scheme: only the allowed ones pass
  if (text.startsWith('//')) return null;
  if (text.startsWith('/')) return safeHref(text);
  if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(text)) return `mailto:${text}`;
  return safeHref(`https://${text}`);
}
