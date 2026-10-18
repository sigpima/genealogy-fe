/**
 * A deliberately small Markdown subset for the family's articles: headings, paragraphs, bold/italic, `code`, lists, quotes,
 * rules, links and `![caption](media:ID)` images. It parses to a tree that the view turns into React elements, so raw HTML is
 * never interpreted (there is nothing to sanitise) and a link can only point at http(s), mailto or a path of this site.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'image'; mediaId: number; alt: string };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'rule' };

/** A link target we are willing to render as a link. */
export function safeHref(href: string): string | null {
  const value = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return null;
}

const INLINE_PATTERN = /!\[([^\]]*)\]\(media:(\d+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|`([^`]+)`/;

// A backslash before one of these shows the character literally (the chronicle editor writes `\*` for a typed star).
// Escaped characters are swapped for private-use placeholders while the patterns run, then restored in the leaves,
// so an escaped `*` can neither open nor close bold and the patterns themselves stay as they were.
const ESCAPABLE = /\\([\\`*_[\]()#+\-.!>])/g;
const PLACEHOLDER_BASE = 0xe000;
const protect = (text: string) => text.replace(ESCAPABLE, (_, ch: string) => String.fromCharCode(PLACEHOLDER_BASE + ch.charCodeAt(0)));
const unprotect = (text: string) => text.replace(/[\ue000-\ue07f]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - PLACEHOLDER_BASE));

export function parseInline(text: string): Inline[] {
  return parseProtected(protect(text));
}

function parseProtected(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match) {
      out.push({ type: 'text', text: unprotect(rest) });
      break;
    }
    if (match.index > 0) out.push({ type: 'text', text: unprotect(rest.slice(0, match.index)) });
    const [whole, imageAlt, imageId, linkText, linkHref, strongA, strongB, emA, emB, code] = match;
    if (imageId !== undefined) {
      out.push({ type: 'image', mediaId: Number(imageId), alt: unprotect(imageAlt) });
    } else if (linkText !== undefined) {
      const href = safeHref(unprotect(linkHref));
      out.push(href ? { type: 'link', href, children: parseProtected(linkText) } : { type: 'text', text: unprotect(linkText) });
    } else if (strongA !== undefined || strongB !== undefined) {
      out.push({ type: 'strong', children: parseProtected(strongA ?? strongB) });
    } else if (emA !== undefined || emB !== undefined) {
      out.push({ type: 'em', children: parseProtected(emA ?? emB) });
    } else if (code !== undefined) {
      out.push({ type: 'code', text: unprotect(code) });
    }
    rest = rest.slice(match.index + whole.length);
  }
  return out;
}

const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ type: 'quote', children: parseInline(quote.join(' ')) });
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flushAll();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3 | 4, children: parseInline(heading[2].trim()) });
      continue;
    }
    if (RULE.test(line)) {
      flushAll();
      blocks.push({ type: 'rule' });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const ordered = numbered !== null;
      if (list && list.ordered !== ordered) flushList();
      list = list ?? { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    const q = QUOTE.exec(line);
    if (q) {
      flushParagraph();
      flushList();
      quote.push(q[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  flushAll();
  return blocks;
}

/** Ids of every `media:` image an article refers to (for the editor's "unused photos" hint and for tests). */
export function mediaIdsIn(source: string): number[] {
  return [...source.matchAll(/!\[[^\]]*\]\(media:(\d+)\)/g)].map((m) => Number(m[1]));
}
