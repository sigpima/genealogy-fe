/**
 * The chronicle editor edits a rich-text document but the article stays Markdown (`articles.body`): the reader, the book PDF
 * and every old article keep working. This file is the bridge, written against the *reader's own parser* (`lib/markdown`), so
 * whatever the reader shows for the text, it shows for the round trip too — that is the meaning of "lossless" here.
 *
 * The editor only offers what the reader knows: headings 1–4, paragraphs, flat lists, one-paragraph quotes, rules, bold, italic,
 * `code`, links (http, https, mailto, site paths) and `media:` images. Characters the reader would take as formatting are
 * written with a backslash (the reader and the book unescape them).
 */
import { parseMarkdown, safeHref, type Block, type Inline } from '../markdown/markdown';

export type DocMark = { type: string; attrs?: Record<string, unknown> };
/** Structurally the same as Tiptap's `JSONContent`, so the editor can hand its document over as it is. */
export type DocNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
};

// ------------------------------------------------------------------ markdown → document

function inlineNodes(inlines: Inline[], marks: DocMark[] = []): DocNode[] {
  const out: DocNode[] = [];
  for (const node of inlines) {
    switch (node.type) {
      case 'text':
        if (node.text) out.push({ type: 'text', text: node.text, ...(marks.length ? { marks } : {}) });
        break;
      case 'strong':
        out.push(...inlineNodes(node.children, [...marks, { type: 'bold' }]));
        break;
      case 'em':
        out.push(...inlineNodes(node.children, [...marks, { type: 'italic' }]));
        break;
      case 'code':
        if (node.text) out.push({ type: 'text', text: node.text, marks: [...marks, { type: 'code' }] });
        break;
      case 'link':
        out.push(...inlineNodes(node.children, [...marks, { type: 'link', attrs: { href: node.href } }]));
        break;
      case 'image':
        out.push({ type: 'image', attrs: { src: `media:${node.mediaId}`, alt: node.alt } });
        break;
    }
  }
  return out;
}

const withContent = (type: string, content: DocNode[], attrs?: Record<string, unknown>): DocNode => ({
  type,
  ...(attrs ? { attrs } : {}),
  ...(content.length ? { content } : {}),
});

function blockNode(block: Block): DocNode {
  switch (block.type) {
    case 'heading':
      return withContent('heading', inlineNodes(block.children), { level: block.level });
    case 'paragraph':
      return withContent('paragraph', inlineNodes(block.children));
    case 'quote':
      return { type: 'blockquote', content: [withContent('paragraph', inlineNodes(block.children))] };
    case 'rule':
      return { type: 'horizontalRule' };
    case 'list':
      return {
        type: block.ordered ? 'orderedList' : 'bulletList',
        content: block.items.map((item) => ({ type: 'listItem', content: [withContent('paragraph', inlineNodes(item))] })),
      };
  }
}

export function markdownToDoc(markdown: string): DocNode {
  const content = parseMarkdown(markdown).map(blockNode);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// ------------------------------------------------------------------ document → markdown

const ESCAPE = /[\\`*_[\]]/g;
const escapeText = (text: string) => text.replace(/\s*\n\s*/g, ' ').replace(ESCAPE, '\\$&');

function hrefForMarkdown(href: string): string | null {
  const safe = safeHref(href);
  if (!safe) return null;
  return safe.replace(/\\/g, '%5C').replace(/\s/g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

const hasMark = (node: DocNode, type: string) => (node.marks ?? []).some((m) => m.type === type);
const linkOf = (node: DocNode): string | null => {
  const mark = (node.marks ?? []).find((m) => m.type === 'link');
  return mark ? hrefForMarkdown(String(mark.attrs?.href ?? '')) : null;
};

/** Delimiters go tight around the words (the reader does not accept `_ x_`): whitespace at either end moves outside. */
function wrap(delimiter: string, inner: string): string {
  const lead = inner.match(/^\s*/)![0];
  const core = inner.slice(lead.length).replace(/\s+$/, '');
  if (core === '') return inner;
  return lead + delimiter + core + delimiter + inner.slice(lead.length + core.length);
}

/** Text of a run of inline nodes. Marks nest in a fixed order (link, bold, italic, code) and neighbours that share a mark share one pair of delimiters. */
function runMarkdown(nodes: DocNode[], level = 0): string {
  const marks = ['link', 'bold', 'italic'] as const;
  if (level === marks.length) {
    return nodes
      .map((node) => {
        if (node.type === 'image') {
          const src = String(node.attrs?.src ?? '');
          const alt = escapeText(String(node.attrs?.alt ?? ''));
          return /^media:\d+$/.test(src) ? `![${alt}](${src})` : alt;
        }
        const text = node.text ?? '';
        return hasMark(node, 'code') && text && !text.includes('`') ? `\`${text.replace(ESCAPE, '\\$&')}\`` : escapeText(text);
      })
      .join('');
  }
  const mark = marks[level];
  let out = '';
  for (let i = 0; i < nodes.length; ) {
    const node = nodes[i];
    const marked = node.type === 'text' && hasMark(node, mark) && (mark !== 'link' || linkOf(node) !== null);
    let j = i + 1;
    if (marked) {
      const href = mark === 'link' ? linkOf(node) : null;
      while (j < nodes.length && nodes[j].type === 'text' && hasMark(nodes[j], mark) && (mark !== 'link' || linkOf(nodes[j]) === href)) j++;
      const inner = runMarkdown(nodes.slice(i, j), level + 1);
      out += mark === 'link' ? (inner ? `[${inner}](${href})` : '') : wrap(mark === 'bold' ? '**' : '_', inner);
    } else {
      while (j < nodes.length && !(nodes[j].type === 'text' && hasMark(nodes[j], mark) && (mark !== 'link' || linkOf(nodes[j]) !== null))) j++;
      out += runMarkdown(nodes.slice(i, j), level + 1);
    }
    i = j;
  }
  return out;
}

/** A paragraph's inline nodes flattened to what this Markdown can carry: text, hard breaks as spaces, images, anything else as its text. */
function flattenInline(nodes: DocNode[] | undefined): DocNode[] {
  return (nodes ?? []).flatMap((node): DocNode[] => {
    if (node.type === 'text' || node.type === 'image') return [node];
    if (node.type === 'hardBreak') return [{ type: 'text', text: ' ' }];
    return flattenInline(node.content);
  });
}

const inlineMarkdown = (nodes: DocNode[] | undefined) => runMarkdown(flattenInline(nodes));

/** All the text of a block's paragraphs on one line (lists and quotes hold one line each in this Markdown). */
function flatInline(node: DocNode): string {
  const parts = (node.content ?? []).map((child) =>
    child.type === 'paragraph' || child.type === 'heading' ? inlineMarkdown(child.content) : child.type === 'text' || child.type === 'image' ? inlineMarkdown([child]) : flatInline(child),
  );
  return parts.filter((p) => p.trim()).join(' ').trim();
}

/** A paragraph that starts with something the reader takes as a block marker keeps it as text. */
function guardLineStart(line: string): string {
  return line.replace(/^(\s*)([#>+-])/, '$1\\$2').replace(/^(\s*\d+)([.)])/, '$1\\$2');
}

function blockMarkdown(node: DocNode): string {
  switch (node.type) {
    case 'heading': {
      const text = inlineMarkdown(node.content).trim();
      const level = Math.min(4, Math.max(1, Number(node.attrs?.level ?? 1)));
      return text ? `${'#'.repeat(level)} ${text}` : '';
    }
    case 'paragraph':
      return guardLineStart(inlineMarkdown(node.content).trim());
    case 'bulletList':
    case 'orderedList': {
      const items = (node.content ?? []).map(flatInline).filter(Boolean);
      return items.map((item, index) => (node.type === 'bulletList' ? `- ${item}` : `${index + 1}. ${item}`)).join('\n');
    }
    case 'blockquote': {
      const text = flatInline(node);
      return text ? `> ${text}` : '';
    }
    case 'horizontalRule':
      return '---';
    case 'text':
    case 'image':
      return guardLineStart(inlineMarkdown([node]).trim());
    default:
      return guardLineStart(flatInline(node));
  }
}

export function docToMarkdown(doc: DocNode): string {
  return (doc.content ?? []).map(blockMarkdown).filter(Boolean).join('\n\n');
}

// ------------------------------------------------------------------ helpers

const MARK_ORDER = ['link', 'bold', 'italic', 'code'];

/** The document with empty paragraphs/text dropped, each block's outer spaces trimmed (the reader trims them), adjacent text with equal marks merged and marks in a fixed order (for comparing). */
export function normalizeDoc(doc: DocNode): DocNode {
  const markKey = (marks: DocMark[] | undefined) => JSON.stringify(sortMarks(marks));
  const sortMarks = (marks: DocMark[] | undefined) =>
    [...(marks ?? [])].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));

  function inline(nodes: DocNode[] | undefined): DocNode[] {
    const out: DocNode[] = [];
    for (const node of nodes ?? []) {
      if (node.type !== 'text') {
        out.push(node);
        continue;
      }
      if (!node.text) continue;
      const last = out[out.length - 1];
      if (last && last.type === 'text' && markKey(last.marks) === markKey(node.marks)) last.text += node.text;
      else out.push({ type: 'text', text: node.text, ...(node.marks?.length ? { marks: sortMarks(node.marks) } : {}) });
    }
    // the reader trims every line, so a block's first and last text never keep their outer spaces
    const first = out[0];
    if (first && first.type === 'text') first.text = first.text!.replace(/^\s+/, '');
    const last = out[out.length - 1];
    if (last && last.type === 'text') last.text = last.text!.replace(/\s+$/, '');
    return out.filter((n) => n.type !== 'text' || n.text);
  }

  function block(node: DocNode): DocNode | null {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const content = inline(node.content);
      if (content.length === 0 && node.type === 'paragraph') return null;
      return { type: node.type, ...(node.attrs ? { attrs: node.attrs } : {}), ...(content.length ? { content } : {}) };
    }
    if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'blockquote' || node.type === 'listItem') {
      const content = (node.content ?? []).map(block).filter((n): n is DocNode => n !== null);
      return content.length ? { type: node.type, content } : null;
    }
    return node.attrs ? { type: node.type, attrs: node.attrs } : { type: node.type };
  }

  return { type: 'doc', content: (doc.content ?? []).map(block).filter((n): n is DocNode => n !== null) };
}

/** Markdown the editor shows as plain text (the reader does too): raw html, tables, fenced code. */
export function unsupportedPresent(markdown: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(markdown) || /^\s*\|.*\|\s*$/m.test(markdown) || /^\s*(```|~~~)/m.test(markdown);
}
