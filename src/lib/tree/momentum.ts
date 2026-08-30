export type Sample = { x: number; y: number; t: number };

export function computeVelocity(prev: Sample, curr: Sample): { vx: number; vy: number } {
  const dt = curr.t - prev.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (curr.x - prev.x) / dt, vy: (curr.y - prev.y) / dt };
}

export const FRICTION = 0.95;
export const MIN_SPEED = 0.01; // px/ms

export function nextMomentumStep(vx: number, vy: number): { vx: number; vy: number } {
  return { vx: vx * FRICTION, vy: vy * FRICTION };
}

export function isMomentumDone(vx: number, vy: number): boolean {
  return Math.hypot(vx, vy) < MIN_SPEED;
}
