import { describe, expect, it } from 'vitest';
import { computeVelocity, isMomentumDone, nextMomentumStep, FRICTION, MIN_SPEED } from './momentum';

describe('computeVelocity', () => {
  it('computes px/ms velocity from two samples', () => {
    const { vx, vy } = computeVelocity({ x: 0, y: 0, t: 0 }, { x: 100, y: 50, t: 100 });
    expect(vx).toBe(1);
    expect(vy).toBe(0.5);
  });

  it('returns zero velocity for a non-positive dt', () => {
    expect(computeVelocity({ x: 0, y: 0, t: 100 }, { x: 50, y: 50, t: 100 })).toEqual({ vx: 0, vy: 0 });
    expect(computeVelocity({ x: 0, y: 0, t: 100 }, { x: 50, y: 50, t: 50 })).toEqual({ vx: 0, vy: 0 });
  });
});

describe('nextMomentumStep', () => {
  it('applies FRICTION exactly', () => {
    const { vx, vy } = nextMomentumStep(10, -4);
    expect(vx).toBeCloseTo(10 * FRICTION, 10);
    expect(vy).toBeCloseTo(-4 * FRICTION, 10);
  });
});

describe('isMomentumDone', () => {
  it('is false above MIN_SPEED (3-4-5 triangle, speed 5)', () => {
    const scale = (MIN_SPEED * 5) / 5; // speed 5x MIN_SPEED, split 3:4
    expect(isMomentumDone(3 * scale, 4 * scale)).toBe(false);
  });

  it('is true at zero velocity', () => {
    expect(isMomentumDone(0, 0)).toBe(true);
  });

  it('is true just below MIN_SPEED', () => {
    expect(isMomentumDone(MIN_SPEED / 2, 0)).toBe(true);
  });
});
