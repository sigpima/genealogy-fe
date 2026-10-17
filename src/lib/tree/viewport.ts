import { zoomLevelFor, type ZoomLevel } from './zoom';

export type Transform = { x: number; y: number; k: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };

export function visibleRect(transform: Transform, width: number, height: number, marginMultiplier = 1): Rect {
  const marginX = width * marginMultiplier;
  const marginY = height * marginMultiplier;
  return {
    x0: (-marginX - transform.x) / transform.k,
    y0: (-marginY - transform.y) / transform.k,
    x1: (width + marginX - transform.x) / transform.k,
    y1: (height + marginY - transform.y) / transform.k,
  };
}

export function filterVisibleNodes<T extends { x: number; y: number }>(nodes: T[], rect: Rect): T[] {
  return nodes.filter((n) => n.x >= rect.x0 && n.x <= rect.x1 && n.y >= rect.y0 && n.y <= rect.y1);
}

export function filterVisibleLinks<T extends { source: { x: number; y: number }; target: { x: number; y: number } }>(
  links: T[],
  rect: Rect
): T[] {
  // Test the link's bounding box, not just its endpoints: a long connector can cross the view
  // with both ends off-screen.
  return links.filter((l) => {
    const minX = Math.min(l.source.x, l.target.x);
    const maxX = Math.max(l.source.x, l.target.x);
    const minY = Math.min(l.source.y, l.target.y);
    const maxY = Math.max(l.source.y, l.target.y);
    return maxX >= rect.x0 && minX <= rect.x1 && maxY >= rect.y0 && minY <= rect.y1;
  });
}

export const VISIBLE_MARGIN = 0.5;

export type Committed = { rect: Rect; level: ZoomLevel };

export function needsRecommit(committed: Committed | null, transform: Transform, width: number, height: number): boolean {
  if (!committed) return true;
  if (zoomLevelFor(transform.k) !== committed.level) return true;
  const view = visibleRect(transform, width, height, 0);
  const { rect } = committed;
  return view.x0 < rect.x0 || view.y0 < rect.y0 || view.x1 > rect.x1 || view.y1 > rect.y1;
}
