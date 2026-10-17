import type { Bounds } from './zoom';
import type { Rect } from './viewport';

export type MinimapProjection = { scale: number; offsetX: number; offsetY: number };

export function minimapProjection(bounds: Bounds, width: number, height: number, padding = 6): MinimapProjection {
  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min((width - 2 * padding) / boundsWidth, (height - 2 * padding) / boundsHeight);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return { scale, offsetX: width / 2 - centerX * scale, offsetY: height / 2 - centerY * scale };
}

export function worldToMinimap(p: { x: number; y: number }, proj: MinimapProjection): { x: number; y: number } {
  return { x: p.x * proj.scale + proj.offsetX, y: p.y * proj.scale + proj.offsetY };
}

export function minimapToWorld(p: { x: number; y: number }, proj: MinimapProjection): { x: number; y: number } {
  return { x: (p.x - proj.offsetX) / proj.scale, y: (p.y - proj.offsetY) / proj.scale };
}

export function viewRectOnMinimap(
  view: Rect,
  proj: MinimapProjection
): { x: number; y: number; width: number; height: number } {
  const topLeft = worldToMinimap({ x: view.x0, y: view.y0 }, proj);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: (view.x1 - view.x0) * proj.scale,
    height: (view.y1 - view.y0) * proj.scale,
  };
}
