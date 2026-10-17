import { describe, expect, it } from 'vitest';
import { mediaIdsIn, parseInline, parseMarkdown, safeHref } from './markdown';

describe('parseInline', () => {
  it('handles emphasis, code and nesting', () => {
    expect(parseInline('a **b** *c* `d`')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'strong', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'em', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'd' },
    ]);
    expect(parseInline('**đậm _nghiêng_**')).toEqual([
      { type: 'strong', children: [{ type: 'text', text: 'đậm ' }, { type: 'em', children: [{ type: 'text', text: 'nghiêng' }] }] },
    ]);
  });
  it('turns [text](url) into a link only for safe targets', () => {
    expect(parseInline('[Zalo](https://zalo.me)')).toEqual([{ type: 'link', href: 'https://zalo.me', children: [{ type: 'text', text: 'Zalo' }] }]);
    expect(parseInline('[trang](/lich)')).toMatchObject([{ type: 'link', href: '/lich' }]);
    // an unsafe target never becomes a link: the text stays (a stray ")" may remain, harmlessly)
    for (const bad of ['[x](javascript:alert(1))', '[x](data:text/html;base64,AAAA)', '[x](//evil.example)', '[x](vbscript:y)']) {
      const nodes = parseInline(bad);
      expect(nodes.some((n) => n.type === 'link')).toBe(false);
      expect(nodes[0]).toEqual({ type: 'text', text: 'x' });
    }
  });
  it('knows media images and ignores other image sources', () => {
    expect(parseInline('![Nhà thờ](media:12)')).toEqual([{ type: 'image', mediaId: 12, alt: 'Nhà thờ' }]);
    const external = parseInline('![x](https://evil.example/a.png)');
    expect(external.some((n) => n.type === 'image')).toBe(false); // only our own media can be embedded, never a remote picture
  });
  it('never turns HTML into elements: it stays text', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([{ type: 'text', text: '<script>alert(1)</script>' }]);
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });
});

describe('parseMarkdown', () => {
  it('splits headings, paragraphs, rules and joins wrapped lines', () => {
    const blocks = parseMarkdown('# Tộc ước\n\nĐiều một\nvẫn là điều một.\n\n---\n\n### Phụ lục');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'rule', 'heading']);
    expect(blocks[0]).toMatchObject({ level: 1 });
    expect(blocks[1]).toEqual({ type: 'paragraph', children: [{ type: 'text', text: 'Điều một vẫn là điều một.' }] });
    expect(blocks[3]).toMatchObject({ level: 3 });
  });
  it('builds bulleted and numbered lists and quotes', () => {
    const blocks = parseMarkdown('- một\n- hai\n\n1. a\n2. b\n\n> trích\n> dẫn');
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect((blocks[0] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: true });
    expect(blocks[2]).toEqual({ type: 'quote', children: [{ type: 'text', text: 'trích dẫn' }] });
  });
  it('switching between list kinds starts a new list', () => {
    const blocks = parseMarkdown('- a\n1. b');
    expect(blocks.map((b) => (b.type === 'list' ? b.ordered : null))).toEqual([false, true]);
  });
  it('copes with empty input and Windows line breaks', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('a\r\n\r\nb')).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('safeHref allows only http(s), mailto and site paths', () => {
    expect(safeHref(' https://a.b ')).toBe('https://a.b');
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeHref('/su-ky')).toBe('/su-ky');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('ftp://x')).toBeNull();
  });
  it('lists the media an article uses', () => {
    expect(mediaIdsIn('a ![x](media:3) b ![y](media:7) ![z](https://q)')).toEqual([3, 7]);
  });
});
