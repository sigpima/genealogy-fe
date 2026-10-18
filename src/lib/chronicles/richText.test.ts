import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../markdown/markdown';
import { LONG_BODIES, SAMPLE_BODIES } from './fixtures';
import { docToMarkdown, markdownToDoc, normalizeDoc, unsupportedPresent, type DocNode } from './richText';

const roundTrip = (md: string) => docToMarkdown(markdownToDoc(md));
/** What the reader shows: the renderer's own tree — the yardstick for "nothing was lost". */
const sameForTheReader = (md: string) => expect(parseMarkdown(roundTrip(md))).toEqual(parseMarkdown(md));

describe('markdown → editor document', () => {
  it('maps every supported construct', () => {
    const doc = markdownToDoc('# Tựa\n\nMột **đậm** _nghiêng_ `mã` [liên kết](https://a.example) ![ảnh](media:7)\n\n- a\n- b\n\n1. x\n2. y\n\n> trích\n\n---');
    expect(doc.content?.map((n) => n.type)).toEqual(['heading', 'paragraph', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule']);
    expect(doc.content?.[0].attrs).toEqual({ level: 1 });
    const inline = doc.content?.[1].content ?? [];
    expect(inline.find((n) => n.marks?.[0]?.type === 'bold')?.text).toBe('đậm');
    expect(inline.find((n) => n.marks?.[0]?.type === 'italic')?.text).toBe('nghiêng');
    expect(inline.find((n) => n.marks?.[0]?.type === 'code')?.text).toBe('mã');
    expect(inline.find((n) => n.marks?.[0]?.type === 'link')?.marks?.[0].attrs).toEqual({ href: 'https://a.example' });
    expect(inline.find((n) => n.type === 'image')?.attrs).toEqual({ src: 'media:7', alt: 'ảnh' });
  });

  it('gives an empty document for empty text', () => {
    expect(markdownToDoc('').content).toEqual([{ type: 'paragraph' }]);
    expect(docToMarkdown(markdownToDoc(''))).toBe('');
  });
});

describe('editor document → markdown', () => {
  it('writes the plain forms the reader and the book understand', () => {
    const doc: DocNode = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Nguồn gốc' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Họ ' },
            { type: 'text', text: 'Nguyễn', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ở ' },
            { type: 'text', text: 'Hà Tĩnh', marks: [{ type: 'italic' }] },
          ],
        },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'một' }] }] }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe('## Nguồn gốc\n\nHọ **Nguyễn** ở _Hà Tĩnh_\n\n- một');
  });

  it('escapes what the reader would otherwise take as formatting', () => {
    const doc: DocNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2*3*4 snake_case [x] `y`' }] }] };
    const md = docToMarkdown(doc);
    expect(md).toBe('2\\*3\\*4 snake\\_case \\[x\\] \\`y\\`');
    expect(parseMarkdown(md)).toEqual([{ type: 'paragraph', children: [{ type: 'text', text: '2*3*4 snake_case [x] `y`' }] }]);
  });

  it('escapes a marker at the start of a paragraph so it stays a paragraph', () => {
    for (const text of ['# không phải tiêu đề', '- không phải danh sách', '1. không phải', '> không phải trích', '---', '+ cộng']) {
      const md = docToMarkdown({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
      expect(parseMarkdown(md)).toEqual([{ type: 'paragraph', children: [{ type: 'text', text }] }]);
    }
  });

  it('keeps whitespace out of the delimiters of bold and italic', () => {
    const doc: DocNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: ' nghiêng ', marks: [{ type: 'italic' }] }, { type: 'text', text: 'x' }] }] };
    expect(docToMarkdown(doc)).toBe('_nghiêng_ x');
  });

  it('encodes characters a link address cannot hold', () => {
    const doc: DocNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a', marks: [{ type: 'link', attrs: { href: 'https://x.example/a b(c)' } }] }] }] };
    const md = docToMarkdown(doc);
    expect(md).toBe('[a](https://x.example/a%20b%28c%29)');
    expect(parseMarkdown(md)[0]).toMatchObject({ children: [{ type: 'link', href: 'https://x.example/a%20b%28c%29' }] });
  });

  it('leaves out empty paragraphs, links without text and links the reader would refuse', () => {
    const doc: DocNode = {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'ok ' }, { type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
      ],
    };
    expect(docToMarkdown(doc)).toBe('ok bad');
  });
});

describe('the round trip does not change what a reader sees', () => {
  for (const [name, md] of Object.entries(SAMPLE_BODIES)) {
    it(`sample: ${name}`, () => {
      sameForTheReader(md);
      expect(roundTrip(roundTrip(md))).toBe(roundTrip(md)); // a second pass changes nothing
    });
  }

  for (const [name, md] of Object.entries(LONG_BODIES)) {
    it(`long chronicle: ${name}`, () => {
      sameForTheReader(md);
      expect(roundTrip(roundTrip(md))).toBe(roundTrip(md));
    });
  }

  it('is exact for already-canonical text', () => {
    const canonical = '# Một\n\nĐoạn **đậm** và _nghiêng_.\n\n- a\n- b\n\n1. x\n2. y\n\n> trích dẫn\n\n---\n\n![ảnh](media:3)';
    expect(roundTrip(canonical)).toBe(canonical);
  });

  it('copes with Windows line endings', () => {
    sameForTheReader('# Tựa\r\n\r\nMột\r\ndòng\r\n\r\n- a\r\n- b\r\n');
  });

  it('keeps every character of what it does not support (html, tables, fenced code), as text', () => {
    const md = '<div class="x">xin chào</div>\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst a = 1;\n```';
    const out = roundTrip(md);
    const count = (text: string) => {
      const map = new Map<string, number>();
      for (const ch of text.replace(/\s/g, '')) map.set(ch, (map.get(ch) ?? 0) + 1);
      return map;
    };
    const before = count(md);
    const after = count(out.replace(/\\/g, ''));
    for (const [ch, n] of before) expect(after.get(ch) ?? 0, `character ${ch}`).toBeGreaterThanOrEqual(n);
    sameForTheReader(md);
  });
});

describe('unsupportedPresent', () => {
  it('spots html, tables and fenced code', () => {
    expect(unsupportedPresent('a <div>b</div>')).toBe(true);
    expect(unsupportedPresent('| a | b |\n|---|---|')).toBe(true);
    expect(unsupportedPresent('```\ncode\n```')).toBe(true);
  });
  it('is quiet for ordinary articles', () => {
    expect(unsupportedPresent('# Tựa\n\n**đậm** và [liên kết](https://a.example), 2 < 3.\n\n- a')).toBe(false);
    expect(unsupportedPresent('')).toBe(false);
  });
});

// A small seeded generator: random documents built from what the editor can produce.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
const WORDS = ['xin', 'chào', 'Nguyễn', '2*3', 'a_b', '[x]', '#', '-', '1.', '>', '`c`', '\\', '!', '(y)', 'ba**', '__', '*', 'Lê', 'họ'];
function randomDoc(next: () => number): DocNode {
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)];
  const words = (n: number) => Array.from({ length: n }, () => pick(WORDS)).join(' ');
  const inline = (): DocNode[] => {
    const out: DocNode[] = [];
    for (let i = 0, n = 1 + Math.floor(next() * 4); i < n; i++) {
      const roll = next();
      if (roll < 0.45) out.push({ type: 'text', text: (i > 0 ? ' ' : '') + words(1 + Math.floor(next() * 3)) + ' ' });
      else if (roll < 0.6) out.push({ type: 'text', text: words(1 + Math.floor(next() * 2)), marks: [{ type: 'bold' }] });
      else if (roll < 0.75) out.push({ type: 'text', text: words(1 + Math.floor(next() * 2)), marks: [{ type: 'italic' }] });
      else if (roll < 0.82) out.push({ type: 'text', text: words(1 + Math.floor(next() * 2)), marks: [{ type: 'bold' }, { type: 'italic' }] });
      else if (roll < 0.9) out.push({ type: 'text', text: words(1), marks: [{ type: 'link', attrs: { href: pick(['https://a.example/x', 'mailto:a@b.c', '/su-ky/abc']) } }] });
      else if (roll < 0.95) out.push({ type: 'text', text: words(1).replace(/`/g, ''), marks: [{ type: 'code' }] });
      else out.push({ type: 'image', attrs: { src: `media:${1 + Math.floor(next() * 90)}`, alt: pick(['ảnh', 'a ] b', '']) } });
    }
    return out;
  };
  const para = (): DocNode => ({ type: 'paragraph', content: inline() });
  const blocks: DocNode[] = [];
  for (let i = 0, n = 1 + Math.floor(next() * 6); i < n; i++) {
    const roll = next();
    if (roll < 0.4) blocks.push(para());
    else if (roll < 0.55) blocks.push({ type: 'heading', attrs: { level: 1 + Math.floor(next() * 4) }, content: inline() });
    else if (roll < 0.7) blocks.push({ type: 'bulletList', content: Array.from({ length: 1 + Math.floor(next() * 3) }, () => ({ type: 'listItem', content: [para()] })) });
    else if (roll < 0.82) blocks.push({ type: 'orderedList', content: Array.from({ length: 1 + Math.floor(next() * 3) }, () => ({ type: 'listItem', content: [para()] })) });
    else if (roll < 0.92) blocks.push({ type: 'blockquote', content: [para()] });
    else blocks.push({ type: 'horizontalRule' });
  }
  return { type: 'doc', content: blocks };
}

describe('random documents survive document → markdown → document', () => {
  it('300 random documents come back equal', () => {
    const next = rng(20261019);
    for (let i = 0; i < 300; i++) {
      const doc = randomDoc(next);
      const md = docToMarkdown(doc);
      const back = markdownToDoc(md);
      expect(normalizeDoc(back), `#${i}\n${md}`).toEqual(normalizeDoc(doc));
    }
  });
});
