// Pure logic for "Xuất ảnh": pick part of the tree, lay it out, draw it as a standalone SVG (explicit colours, so it
// does not depend on the page's CSS) and wrap a JPEG into a one-page PDF. Relative imports: vitest has no `@/` alias.
import type { HierarchyPointNode } from 'd3-hierarchy';
import { computeLayout } from '../tree/layout';
import type { FamilyMember } from '../tree/types';

export type ExportScope = { rootId: number | null; maxGenerations: number | null };

export type ExportTheme = {
  background: string;
  card: string;
  text: string;
  muted: string;
  connector: string;
  border: string;
  primary: string;
};

export const DEFAULT_THEME: ExportTheme = {
  background: '#f9f6f0',
  card: '#ffffff',
  text: '#1c1c18',
  muted: '#564242',
  connector: '#8c7d70',
  border: '#e3dcd1',
  primary: '#8b2635',
};

export function findNode(root: FamilyMember, id: number): FamilyMember | null {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === id) return node;
    for (const child of node.children ?? []) stack.push(child);
  }
  return null;
}

/** The part of the tree to print: below `rootId` (whole tree when null/unknown), `maxGenerations` deep (head = 1). */
export function pruneTree(root: FamilyMember, scope: ExportScope): FamilyMember {
  const head = (scope.rootId !== null && findNode(root, scope.rootId)) || root;
  const limit = scope.maxGenerations !== null && scope.maxGenerations >= 1 ? scope.maxGenerations : Infinity;
  function copy(node: FamilyMember, depth: number): FamilyMember {
    const kids = depth >= limit ? [] : (node.children ?? []);
    return { id: node.id, name: node.name, children: kids.map((k) => copy(k, depth + 1)) };
  }
  return copy(head, 1);
}

export function countPeople(root: FamilyMember): number {
  let n = 0;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    n += 1;
    for (const child of node.children ?? []) stack.push(child);
  }
  return n;
}

export const CARD = { w: 128, h: 52 };
const SLOT = { x: 144, y: 100 };
const MARGIN = 28;
const HEADER = 44;

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** Split a name into at most two lines of about `max` characters; a too-long second line is cut with "…". */
export function wrapName(name: string, max = 17): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (trial.length <= max || !current) current = trial;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 2) return lines;
  // keep the given name (last word) visible
  return [lines[0], `…${lines[lines.length - 1]}`];
}

export type SvgOptions = {
  title: string;
  /** member id -> "1925 – 1999" */
  years?: Map<number, string>;
  /** member id -> branch colour */
  branchColor?: (id: number) => string | undefined;
  theme?: ExportTheme;
  footer?: string;
};

export type DrawnSvg = { svg: string; width: number; height: number; people: number };

export function buildTreeSvg(root: FamilyMember, options: SvgOptions): DrawnSvg {
  const theme = options.theme ?? DEFAULT_THEME;
  const { nodes, links } = computeLayout(root, new Set(), SLOT, { siblings: 1, nonSiblings: 1.25 });
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }
  const bodyW = maxX - minX + CARD.w;
  const titleW = options.title.length * 9 + 20;
  const width = Math.ceil(Math.max(bodyW, titleW) + 2 * MARGIN);
  const height = Math.ceil(maxY + CARD.h + 2 * MARGIN + HEADER + (options.footer ? 18 : 0));
  const offX = MARGIN + (width - 2 * MARGIN - bodyW) / 2 + CARD.w / 2 - minX;
  const offY = MARGIN + HEADER;
  const px = (n: { x: number }) => (n.x + offX).toFixed(1);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'Be Vietnam Pro','Segoe UI',Roboto,Arial,sans-serif">`,
    `<rect width="${width}" height="${height}" fill="${theme.background}"/>`,
    `<text x="${MARGIN}" y="${MARGIN + 16}" font-size="20" font-weight="700" fill="${theme.primary}">${escapeXml(options.title)}</text>`
  );
  // connectors first so the cards cover their ends
  parts.push(`<g fill="none" stroke="${theme.connector}" stroke-width="1.4">`);
  for (const link of links) {
    const sx = Number(px(link.source));
    const tx = Number(px(link.target));
    const sy = link.source.y + offY + CARD.h;
    const ty = link.target.y + offY;
    const mid = sy + (ty - sy) / 2;
    parts.push(`<path d="M${sx},${sy} V${mid} H${tx} V${ty}"/>`);
  }
  parts.push('</g>');
  for (const n of nodes as HierarchyPointNode<FamilyMember>[]) {
    const x = Number(px(n)) - CARD.w / 2;
    const y = n.y + offY;
    const id = n.data.id;
    const color = id !== undefined ? options.branchColor?.(id) : undefined;
    parts.push(`<g><rect x="${x}" y="${y}" width="${CARD.w}" height="${CARD.h}" rx="7" fill="${theme.card}" stroke="${theme.border}" stroke-width="1.2"/>`);
    if (color) parts.push(`<rect x="${x + 3}" y="${y + 7}" width="4" height="${CARD.h - 14}" rx="2" fill="${escapeXml(color)}"/>`);
    const lines = wrapName(n.data.name);
    const years = id !== undefined ? options.years?.get(id) : undefined;
    const textTop = y + (years ? 17 : 24) - (lines.length > 1 ? 6 : 0);
    lines.forEach((line, i) => {
      parts.push(`<text x="${x + CARD.w / 2 + 3}" y="${textTop + i * 13}" font-size="11.5" font-weight="700" text-anchor="middle" fill="${theme.text}">${escapeXml(line)}</text>`);
    });
    if (years) parts.push(`<text x="${x + CARD.w / 2 + 3}" y="${y + CARD.h - 8}" font-size="9.5" text-anchor="middle" fill="${theme.muted}">${escapeXml(years)}</text>`);
    parts.push('</g>');
  }
  if (options.footer) {
    parts.push(`<text x="${width - MARGIN}" y="${height - 12}" font-size="10" text-anchor="end" fill="${theme.muted}">${escapeXml(options.footer)}</text>`);
  }
  parts.push('</svg>');
  return { svg: parts.join(''), width, height, people: nodes.length };
}

export type RasterPlan = { scale: number; width: number; height: number; reduced: boolean };

/** Pixel size for a drawing: sharp (x2) when small, scaled down to stay inside what a browser canvas can hold. */
export function planRaster(width: number, height: number, maxSide = 12000, maxPixels = 60_000_000): RasterPlan {
  const scale = Math.min(2, maxSide / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
  return { scale, width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), reduced: scale < 1 };
}

/** "1925 – 1999", "1950 –", "? – 1970"; nothing when both are unknown. */
export function yearsLabel(birth: number | null, death: number | null): string {
  if (birth === null && death === null) return '';
  return `${birth ?? '?'} – ${death ?? ''}`.trimEnd();
}

const encoder = new TextEncoder();

/** A one-page PDF holding a single JPEG, the page sized A4/A3-like for the image's orientation. */
export function buildPdf(jpeg: Uint8Array, pixelWidth: number, pixelHeight: number): Uint8Array<ArrayBuffer> {
  const landscape = pixelWidth >= pixelHeight;
  const [pageW, pageH] = landscape ? [1190.55, 841.89] : [841.89, 1190.55]; // A3
  const margin = 28;
  const fit = Math.min((pageW - 2 * margin) / pixelWidth, (pageH - 2 * margin) / pixelHeight);
  const w = pixelWidth * fit;
  const h = pixelHeight * fit;
  const x = (pageW - w) / 2;
  const y = (pageH - h) / 2;
  const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  push('%PDF-1.4\n%âãÏÓ\n');
  const object = (n: number, body: string | (() => void)) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream');
  });
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export function exportFileName(label: string, extension: 'png' | 'pdf'): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `gia-pha-${base || 'cay'}.${extension}`;
}
