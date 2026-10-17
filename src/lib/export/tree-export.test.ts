import { describe, expect, it } from 'vitest';
import {
  buildPdf,
  buildTreeSvg,
  countPeople,
  exportFileName,
  findNode,
  planRaster,
  pruneTree,
  wrapName,
  yearsLabel,
} from './tree-export';
import type { FamilyMember } from '../tree/types';

const tree: FamilyMember = {
  id: 1,
  name: 'Nguyễn Văn Tổ',
  children: [
    { id: 2, name: 'Nguyễn Văn An', children: [{ id: 4, name: 'Nguyễn Văn Anh', children: [{ id: 5, name: 'Nguyễn Văn Sâu' }] }] },
    { id: 3, name: 'Nguyễn Thị Bình & Co' },
  ],
};

describe('pruneTree', () => {
  it('keeps the whole tree by default', () => {
    expect(countPeople(pruneTree(tree, { rootId: null, maxGenerations: null }))).toBe(5);
  });
  it('takes the subtree below a person', () => {
    const sub = pruneTree(tree, { rootId: 2, maxGenerations: null });
    expect(sub.id).toBe(2);
    expect(countPeople(sub)).toBe(3);
  });
  it('limits the depth, the head counting as generation 1', () => {
    expect(countPeople(pruneTree(tree, { rootId: null, maxGenerations: 2 }))).toBe(3);
    expect(countPeople(pruneTree(tree, { rootId: 2, maxGenerations: 1 }))).toBe(1);
  });
  it('falls back to the whole tree for an unknown person and does not alter the input', () => {
    expect(pruneTree(tree, { rootId: 99, maxGenerations: null }).id).toBe(1);
    pruneTree(tree, { rootId: null, maxGenerations: 1 });
    expect(findNode(tree, 5)?.name).toBe('Nguyễn Văn Sâu');
  });
});

describe('buildTreeSvg', () => {
  it('draws one card per person with escaped text, years and branch colours', () => {
    const out = buildTreeSvg(tree, {
      title: 'Họ Nguyễn & con cháu',
      years: new Map([[2, '1925 – 1999']]),
      branchColor: (id) => (id === 2 ? '#1b4d3e' : undefined),
    });
    expect(out.people).toBe(5);
    expect(out.svg.startsWith('<svg')).toBe(true);
    expect(out.svg).toContain('Họ Nguyễn &amp; con cháu');
    expect(out.svg).toContain('Bình &amp;');
    expect(out.svg).toContain('1925 – 1999');
    expect(out.svg).toContain('#1b4d3e');
    expect(out.svg.match(/<path /g)?.length).toBe(4); // one connector per parent-child link
    expect(out.width).toBeGreaterThan(300);
    expect(out.height).toBeGreaterThan(300);
  });
  it('is wider for wider trees and always uses explicit colours (no CSS variables)', () => {
    const wide: FamilyMember = { id: 1, name: 'A', children: Array.from({ length: 10 }, (_, i) => ({ id: i + 2, name: `Con ${i}` })) };
    expect(buildTreeSvg(wide, { title: 't' }).width).toBeGreaterThan(buildTreeSvg(tree, { title: 't' }).width);
    expect(buildTreeSvg(wide, { title: 't' }).svg).not.toContain('var(');
  });
});

describe('wrapName', () => {
  it('wraps long names in two lines and keeps the given name', () => {
    expect(wrapName('Nguyễn Văn An')).toEqual(['Nguyễn Văn An']);
    expect(wrapName('Nguyễn Hữu Thị Ngọc Bích Lan')).toHaveLength(2);
    expect(wrapName('Nguyễn Hữu Thị Ngọc Bích Lan')[1]).toContain('Lan');
  });
});

describe('planRaster', () => {
  it('is sharp for small drawings and scaled down for huge ones', () => {
    expect(planRaster(800, 600)).toMatchObject({ scale: 2, reduced: false });
    const big = planRaster(60000, 4000);
    expect(big.reduced).toBe(true);
    expect(Math.max(big.width, big.height)).toBeLessThanOrEqual(12000);
    expect(big.width * big.height).toBeLessThanOrEqual(60_000_000);
  });
});

describe('buildPdf', () => {
  it('wraps the JPEG into a valid one-page PDF with correct xref offsets', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    const pdf = buildPdf(jpeg, 1000, 500);
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/DCTDecode');
    expect(text).toContain('/Width 1000 /Height 500');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const entries = [...text.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((offset, i) => expect(text.slice(offset, offset + 8)).toBe(`${i + 1} 0 obj\n`));
    // the JPEG bytes are embedded untouched
    const at = pdf.findIndex((_, i) => pdf[i] === 0xff && pdf[i + 1] === 0xd8 && pdf[i + 2] === 1);
    expect([...pdf.slice(at, at + 7)]).toEqual([...jpeg]);
  });
  it('uses a landscape page for wide images and a portrait one for tall images', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    expect(new TextDecoder('latin1').decode(buildPdf(jpeg, 200, 100))).toContain('MediaBox [0 0 1190.55 841.89]');
    expect(new TextDecoder('latin1').decode(buildPdf(jpeg, 100, 200))).toContain('MediaBox [0 0 841.89 1190.55]');
  });
});

describe('small helpers', () => {
  it('formats years and file names', () => {
    expect(yearsLabel(1925, 1999)).toBe('1925 – 1999');
    expect(yearsLabel(1950, null)).toBe('1950 –');
    expect(yearsLabel(null, 1970)).toBe('? – 1970');
    expect(yearsLabel(null, null)).toBe('');
    expect(exportFileName('Chi Đức Nguyễn', 'png')).toBe('gia-pha-chi-duc-nguyen.png');
    expect(exportFileName('', 'pdf')).toBe('gia-pha-cay.pdf');
  });
});
