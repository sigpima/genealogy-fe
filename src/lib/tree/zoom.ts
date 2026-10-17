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

export type FitPadding = number | { top: number; right: number; bottom: number; left: number };

export function fitTransform(bounds: Bounds, width: number, height: number, padding: FitPadding = 48): Transform {
  const pad = typeof padding === 'number' ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
  // Never let the usable box collapse to nothing (tiny containers), or k would go negative.
  const availWidth = Math.max(width - pad.left - pad.right, 1);
  const availHeight = Math.max(height - pad.top - pad.bottom, 1);
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const k = Math.min(1, availWidth / boundsWidth, availHeight / boundsHeight);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    k,
    x: pad.left + availWidth / 2 - centerX * k,
    y: pad.top + availHeight / 2 - centerY * k,
  };
}

export function clampZoom(k: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, k));
}

export function minZoomFor(fitK: number, floor = 0.15): number {
  return Math.max(0.001, Math.min(floor, fitK));
}

export type ViewState = Transform & { minZoom: number; maxZoom: number };
