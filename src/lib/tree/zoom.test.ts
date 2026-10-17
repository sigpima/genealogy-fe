import { describe, expect, it } from 'vitest';
import { boundsOf, fitTransform, minZoomFor, padBounds, zoomLevelFor } from './zoom';

describe('zoomLevelFor', () => {
  it('uses the design thresholds', () => {
    expect(zoomLevelFor(0.39)).toBe('dot');
    expect(zoomLevelFor(0.4)).toBe('compact');
    expect(zoomLevelFor(0.8)).toBe('compact');
    expect(zoomLevelFor(0.81)).toBe('detailed');
  });
});

describe('boundsOf / padBounds', () => {
  it('returns null for no points', () => {
    expect(boundsOf([])).toBeNull();
  });
  it('spans all points', () => {
    expect(
      boundsOf([
        { x: 1, y: 2 },
        { x: 5, y: -3 },
      ])
    ).toEqual({ minX: 1, minY: -3, maxX: 5, maxY: 2 });
  });
  it('pads each side', () => {
    expect(padBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 5, 2)).toEqual({
      minX: -5,
      minY: -2,
      maxX: 15,
      maxY: 12,
    });
  });
});

describe('fitTransform', () => {
  it('scales to the tighter axis and centres the bounds', () => {
    const t = fitTransform({ minX: 0, minY: 0, maxX: 1000, maxY: 500 }, 800, 600, 0);
    expect(t.k).toBeCloseTo(0.8);
    expect(500 * t.k + t.x).toBeCloseTo(400);
    expect(250 * t.k + t.y).toBeCloseTo(300);
  });
  it('stays finite and never zooms past 100% for a single point', () => {
    const t = fitTransform({ minX: 7, minY: 7, maxX: 7, maxY: 7 }, 800, 600);
    expect(Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.k)).toBe(true);
    expect(t.k).toBeLessThanOrEqual(1);
  });
  it('never exceeds k = 1 for tiny bounds', () => {
    expect(fitTransform({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 800, 600).k).toBe(1);
  });
});

describe('minZoomFor', () => {
  it('lets the fit scale lower the floor', () => {
    expect(minZoomFor(0.01)).toBe(0.01);
  });
  it('keeps the floor when the tree fits above it', () => {
    expect(minZoomFor(0.5)).toBe(0.15);
  });
  it('stays positive for a degenerate fit', () => {
    expect(minZoomFor(0)).toBeGreaterThan(0);
  });
});
