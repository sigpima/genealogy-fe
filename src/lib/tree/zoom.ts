import type { Transform } from './viewport';

export type ZoomLevel = 'dot' | 'compact' | 'detailed';

export const DOT_MAX_ZOOM = 0.4;
export const COMPACT_MAX_ZOOM = 0.8;

export function zoomLevelFor(k: number): ZoomLevel {
  if (k < DOT_MAX_ZOOM) return 'dot';
  if (k <= COMPACT_MAX_ZOOM) return 'compact';
  return 'detailed';
}

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function boundsOf(points: { x: number; y: number }[]): Bounds | null {
  if (points.length === 0) return null;
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    if (p.x < bounds.minX) bounds.minX = p.x;
    if (p.x > bounds.maxX) bounds.maxX = p.x;
    if (p.y < bounds.minY) bounds.minY = p.y;
    if (p.y > bounds.maxY) bounds.maxY = p.y;
  }
  return bounds;
}

export function padBounds(bounds: Bounds, padX: number, padY: number): Bounds {
  return {
    minX: bounds.minX - padX,
    minY: bounds.minY - padY,
    maxX: bounds.maxX + padX,
    maxY: bounds.maxY + padY,
  };
}

export function fitTransform(bounds: Bounds, width: number, height: number, padding = 48): Transform {
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const k = Math.min(1, (width - 2 * padding) / boundsWidth, (height - 2 * padding) / boundsHeight);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return { k, x: width / 2 - centerX * k, y: height / 2 - centerY * k };
}

export function minZoomFor(fitK: number, floor = 0.15): number {
  return Math.max(0.001, Math.min(floor, fitK));
}

export type ViewState = Transform & { minZoom: number; maxZoom: number };
