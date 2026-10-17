import { describe, expect, it } from 'vitest';
import { VISIBLE_MARGIN, filterVisibleLinks, filterVisibleNodes, needsRecommit, visibleRect } from './viewport';
import { zoomLevelFor } from './zoom';

describe('visibleRect', () => {
  it('computes the buffered rect at identity scale', () => {
    const rect = visibleRect({ x: 0, y: 0, k: 1 }, 800, 600, 1);
    expect(rect).toEqual({ x0: -800, y0: -600, x1: 1600, y1: 1200 });
  });

  it('divides by scale when inverting a zoomed-in transform', () => {
    const rect = visibleRect({ x: 0, y: 0, k: 2 }, 800, 600, 1);
    expect(rect.x0).toBe(-400);
    expect(rect.x1).toBe(800);
  });

  it('accounts for translation', () => {
    const rect = visibleRect({ x: 100, y: 0, k: 1 }, 800, 600, 1);
    expect(rect.x0).toBe(-900);
    expect(rect.x1).toBe(1500);
  });
});

describe('filterVisibleNodes', () => {
  const rect = { x0: 0, y0: 0, x1: 100, y1: 100 };

  it('includes nodes on the boundary', () => {
    expect(filterVisibleNodes([{ x: 0, y: 0 }, { x: 100, y: 100 }], rect)).toHaveLength(2);
  });

  it('excludes nodes just outside the boundary', () => {
    expect(filterVisibleNodes([{ x: -1, y: 0 }, { x: 0, y: 101 }], rect)).toHaveLength(0);
  });
});

describe('filterVisibleLinks', () => {
  const rect = { x0: 0, y0: 0, x1: 100, y1: 100 };

  it('includes a link when only one endpoint is inside the rect', () => {
    const links = [{ source: { x: 50, y: 50 }, target: { x: 500, y: 500 } }];
    expect(filterVisibleLinks(links, rect)).toHaveLength(1);
  });

  it('excludes a link with both endpoints outside the rect', () => {
    const links = [{ source: { x: 500, y: 500 }, target: { x: 600, y: 600 } }];
    expect(filterVisibleLinks(links, rect)).toHaveLength(0);
  });

  it('includes a long link that crosses the rect with both endpoints outside it', () => {
    const links = [{ source: { x: -500, y: 50 }, target: { x: 600, y: 50 } }];
    expect(filterVisibleLinks(links, rect)).toHaveLength(1);
  });

  it('excludes a long link whose span passes beside the rect', () => {
    const links = [{ source: { x: -500, y: 300 }, target: { x: 600, y: 300 } }];
    expect(filterVisibleLinks(links, rect)).toHaveLength(0);
  });
});

describe('needsRecommit', () => {
  const w = 800;
  const h = 600;
  const commit = (t: { x: number; y: number; k: number }) => ({
    rect: visibleRect(t, w, h, VISIBLE_MARGIN),
    level: zoomLevelFor(t.k),
  });
  const start = { x: 0, y: 0, k: 1 };

  it('requires a first commit', () => {
    expect(needsRecommit(null, start, w, h)).toBe(true);
  });
  it('tolerates a small pan inside the committed margin', () => {
    expect(needsRecommit(commit(start), { x: -200, y: 0, k: 1 }, w, h)).toBe(false);
  });
  it('recommits once the viewport escapes the margin', () => {
    expect(needsRecommit(commit(start), { x: -480, y: 0, k: 1 }, w, h)).toBe(true);
  });
  it('recommits when the zoom level changes', () => {
    expect(needsRecommit(commit({ x: 0, y: 0, k: 0.5 }), { x: 0, y: 0, k: 0.9 }, w, h)).toBe(true);
  });
  it('recommits when zooming out within a level exposes uncommitted area', () => {
    expect(needsRecommit(commit({ x: 0, y: 0, k: 2.5 }), { x: 0, y: 0, k: 0.9 }, w, h)).toBe(true);
  });
});
