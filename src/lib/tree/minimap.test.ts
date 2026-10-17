import { describe, expect, it } from 'vitest';
import { minimapProjection, minimapToWorld, viewRectOnMinimap, worldToMinimap } from './minimap';

const bounds = { minX: -1000, minY: 0, maxX: 3000, maxY: 1000 };

describe('minimapProjection', () => {
  it('fits the projected bounds inside the box', () => {
    const proj = minimapProjection(bounds, 200, 120, 6);
    const topLeft = worldToMinimap({ x: bounds.minX, y: bounds.minY }, proj);
    const bottomRight = worldToMinimap({ x: bounds.maxX, y: bounds.maxY }, proj);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(200);
    expect(bottomRight.y).toBeLessThanOrEqual(120);
  });
  it('round-trips world <-> minimap coordinates', () => {
    const proj = minimapProjection(bounds, 200, 120);
    const world = { x: 1234, y: 321 };
    const back = minimapToWorld(worldToMinimap(world, proj), proj);
    expect(back.x).toBeCloseTo(world.x);
    expect(back.y).toBeCloseTo(world.y);
  });
  it('stays finite for single-point bounds', () => {
    const proj = minimapProjection({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 200, 120);
    expect([proj.scale, proj.offsetX, proj.offsetY].every(Number.isFinite)).toBe(true);
    expect(proj.scale).toBeGreaterThan(0);
  });
});

describe('viewRectOnMinimap', () => {
  it('maps a world rect equal to the bounds onto the projected bounds', () => {
    const proj = minimapProjection(bounds, 200, 120);
    const rect = viewRectOnMinimap({ x0: bounds.minX, y0: bounds.minY, x1: bounds.maxX, y1: bounds.maxY }, proj);
    const topLeft = worldToMinimap({ x: bounds.minX, y: bounds.minY }, proj);
    expect(rect.x).toBeCloseTo(topLeft.x);
    expect(rect.y).toBeCloseTo(topLeft.y);
    expect(rect.width).toBeCloseTo((bounds.maxX - bounds.minX) * proj.scale);
    expect(rect.height).toBeCloseTo((bounds.maxY - bounds.minY) * proj.scale);
  });
});
