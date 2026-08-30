# Tree Canvas Animation (3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expand/collapse + viewport-boundary fade (`framer-motion`), eased programmatic zoom/pan (`d3-transition`), and mouse/touch drag momentum to `TreeCanvas`, on top of sub-project 3a's viewport-virtualized renderer.

**Architecture:** Three independent additions to `TreeCanvas.tsx`: (1) `AnimatePresence` + `motion.g`/`motion.path` wrapping the existing node/link render, fading any add/remove regardless of cause; (2) the four `TreeCanvasHandle` methods drive their transform changes through a `d3-transition` instead of setting it instantly; (3) a small pure module (`src/lib/tree/momentum.ts`) provides the velocity/friction math, and `TreeCanvas` tracks pointer-drag samples via `d3-zoom`'s `start`/`zoom`/`end` events, running a `requestAnimationFrame` coast on release.

**Tech Stack:** Next.js 15, React 19, TypeScript, `framer-motion` (already a dependency, first real use), `d3-transition` (new explicit dependency — transitively available already, same as `d3-zoom` was before 3a), Vitest (existing setup).

**Spec:** `docs/superpowers/specs/2026-08-30-tree-canvas-animation-design.md`

**Depends on:** `2026-08-30-tree-canvas-design.md`'s plan (3a, already implemented) — this plan modifies the `TreeCanvas.tsx` it produced.

## Global Constraints

- Live pointer dragging must never go through a transition (1:1 with the pointer) — only programmatic transform changes (`zoomIn`/`zoomOut`/`resetView`/`centerOnNode`) and the momentum coast use eased/animated motion.
- Momentum only follows a mouse/touch drag release (`event.sourceEvent.type` is `mouseup`/`touchend`) — never a wheel-zoom gesture.
- No change to 3a's layout, virtualization filtering, or LOD/lazy-detail integration.
- `npx tsc --noEmit`, `npm run test`, and `npm run build` must all pass after every task.

---

## File Structure

```
genealogy-web/
  package.json                              # modified: +@types/d3-transition
  src/
    lib/tree/
      momentum.ts                             # new: computeVelocity, nextMomentumStep, isMomentumDone
      momentum.test.ts                          # new
    components/tree/
      TreeCanvas.tsx                              # modified (Tasks 2-4)
```

---

### Task 1: `momentum.ts` (TDD)

**Files:**
- Create: `src/lib/tree/momentum.ts`, `src/lib/tree/momentum.test.ts`

**Interfaces:**
- Produces: `Sample = {x: number, y: number, t: number}`, `computeVelocity(prev: Sample, curr: Sample): {vx: number, vy: number}`, `FRICTION: number`, `MIN_SPEED: number`, `nextMomentumStep(vx: number, vy: number): {vx: number, vy: number}`, `isMomentumDone(vx: number, vy: number): boolean` — all from `src/lib/tree/momentum.ts`, imported by Task 4 as `import { computeVelocity, isMomentumDone, nextMomentumStep, type Sample } from '@/lib/tree/momentum'`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tree/momentum.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- momentum`
Expected: FAIL — `Cannot find module './momentum'`.

- [ ] **Step 3: Implement `momentum.ts`**

Create `src/lib/tree/momentum.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- momentum`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tree/momentum.ts src/lib/tree/momentum.test.ts
git commit -m "feat: add momentum physics helpers (velocity, friction, stop condition)"
```

---

### Task 2: Expand/collapse and viewport-boundary fade

**Files:**
- Modify: `src/components/tree/TreeCanvas.tsx`

- [ ] **Step 1: Import `framer-motion`**

Change:

```ts
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
```

to:

```ts
import { AnimatePresence, motion } from 'framer-motion';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
```

- [ ] **Step 2: Wrap the node/link render in `AnimatePresence`**

Change:

```tsx
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {visibleLinks.map((link) => (
            <path
              key={`${link.source.data.id}-${link.target.data.id}`}
              d={stepPath(link.source, link.target)}
              className="fill-none stroke-border"
            />
          ))}
          {visibleNodes.map((node) => (
            <g key={node.data.id} transform={`translate(${node.x},${node.y})`}>
              {renderNode(node)}
            </g>
          ))}
        </g>
```

to:

```tsx
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <AnimatePresence>
            {visibleLinks.map((link) => (
              <motion.path
                key={`${link.source.data.id}-${link.target.data.id}`}
                d={stepPath(link.source, link.target)}
                className="fill-none stroke-border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            ))}
            {visibleNodes.map((node) => (
              <motion.g
                key={node.data.id}
                transform={`translate(${node.x},${node.y})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {renderNode(node)}
              </motion.g>
            ))}
          </AnimatePresence>
        </g>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open the tree page, click a node's `+`/`−` toggle.
Expected: the toggled subtree's nodes/links fade in or out instead of
popping instantly. (Full end-to-end manual verification, including
this, happens again in Task 4's Step 8 — this is a quick sanity check
before moving on.)

- [ ] **Step 5: Commit**

```bash
git add src/components/tree/TreeCanvas.tsx
git commit -m "feat: fade tree nodes/links in and out instead of popping"
```

---

### Task 3: Eased programmatic zoom/pan

**Files:**
- Modify: `src/components/tree/TreeCanvas.tsx`, `package.json`

- [ ] **Step 1: Add `@types/d3-transition`**

`d3-transition`'s JS module is already resolvable (a transitive dependency
of the existing `d3` package). In `package.json`, change:

```json
    "@types/d3-shape": "^3.1.7",
```

to:

```json
    "@types/d3-shape": "^3.1.7",
    "@types/d3-transition": "^3.0.9",
```

Run: `npm install`
Expected: no new packages downloaded, `package-lock.json` updated.

- [ ] **Step 2: Import `d3-transition` for its `Selection.transition()` side effect**

Change:

```ts
import { select } from 'd3-selection';
```

to:

```ts
import { select } from 'd3-selection';
import 'd3-transition';
```

(`d3-transition` isn't referenced by name anywhere else in this file — importing it for its side effect is what makes `.transition()` exist on a `d3-selection` `Selection`/registers the runtime behavior, per `@types/d3-transition`'s `declare module "d3-selection"` augmentation.)

- [ ] **Step 3: Transition the four imperative methods**

Change:

```ts
    centerOnNode(id: number) {
      if (!dimensions || !svgRef.current || !zoomBehaviorRef.current) return;
      const node = layout.nodes.find((n) => n.data.id === id);
      if (!node) return;
      const k = transform.k;
      const next = zoomIdentity
        .translate(dimensions.width / 2 - node.x * k, dimensions.height / 2 - node.y * k)
        .scale(k);
      select(svgRef.current).call(zoomBehaviorRef.current.transform, next);
    },
    zoomIn() {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 1.2);
    },
    zoomOut() {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 1 / 1.2);
    },
    resetView() {
      if (!dimensions || !svgRef.current || !zoomBehaviorRef.current) return;
      const initial = zoomIdentity.translate(dimensions.width / 2, dimensions.height / 6).scale(initialZoom);
      select(svgRef.current).call(zoomBehaviorRef.current.transform, initial);
    },
```

to:

```ts
    centerOnNode(id: number) {
      if (!dimensions || !svgRef.current || !zoomBehaviorRef.current) return;
      const node = layout.nodes.find((n) => n.data.id === id);
      if (!node) return;
      const k = transform.k;
      const next = zoomIdentity
        .translate(dimensions.width / 2 - node.x * k, dimensions.height / 2 - node.y * k)
        .scale(k);
      select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, next);
    },
    zoomIn() {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.scaleBy, 1.2);
    },
    zoomOut() {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.scaleBy, 1 / 1.2);
    },
    resetView() {
      if (!dimensions || !svgRef.current || !zoomBehaviorRef.current) return;
      const initial = zoomIdentity.translate(dimensions.width / 2, dimensions.height / 6).scale(initialZoom);
      select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, initial);
    },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, click the zoom in/out/reset buttons and select a
search result.
Expected: each eases smoothly to its new position/scale instead of
snapping instantly. Dragging the canvas with the mouse still tracks the
pointer directly (unaffected by this task).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/tree/TreeCanvas.tsx
git commit -m "feat: ease programmatic zoom/pan (buttons, search-center)"
```

---

### Task 4: Drag momentum

**Files:**
- Modify: `src/components/tree/TreeCanvas.tsx`

**Interfaces:**
- Consumes: `computeVelocity`, `isMomentumDone`, `nextMomentumStep`, `Sample` (Task 1).

- [ ] **Step 1: Import the momentum helpers**

Change:

```ts
import { filterVisibleLinks, filterVisibleNodes, visibleRect } from '@/lib/tree/viewport';
```

to:

```ts
import { computeVelocity, isMomentumDone, nextMomentumStep, type Sample } from '@/lib/tree/momentum';
import { filterVisibleLinks, filterVisibleNodes, visibleRect } from '@/lib/tree/viewport';
```

- [ ] **Step 2: Track drag samples and velocity, and run momentum on release**

Change:

```ts
  useEffect(() => {
    if (!svgRef.current || !dimensions) return;
    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([scaleExtent.min, scaleExtent.max])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });
    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(svgRef.current);
    selection.call(zoomBehavior);
    const initial = zoomIdentity.translate(dimensions.width / 2, dimensions.height / 6).scale(initialZoom);
    selection.call(zoomBehavior.transform, initial);
    // dimensions is measured once on mount (see this plan's Global Constraints on why there's
    // no resize handling), so this effect intentionally only re-runs if it changes from null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]);
```

to:

```ts
  const lastSampleRef = useRef<Sample | null>(null);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const momentumFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!svgRef.current || !dimensions) return;

    function runMomentum() {
      if (isMomentumDone(velocityRef.current.vx, velocityRef.current.vy)) return;
      let lastFrameTime = performance.now();
      const step = () => {
        const now = performance.now();
        const dt = now - lastFrameTime;
        lastFrameTime = now;
        const { vx, vy } = velocityRef.current;
        if (!svgRef.current || !zoomBehaviorRef.current || isMomentumDone(vx, vy)) {
          momentumFrameRef.current = null;
          return;
        }
        select(svgRef.current).call(
          zoomBehaviorRef.current.translateBy,
          (vx * dt) / transformRef.current.k,
          (vy * dt) / transformRef.current.k
        );
        velocityRef.current = nextMomentumStep(vx, vy);
        momentumFrameRef.current = requestAnimationFrame(step);
      };
      momentumFrameRef.current = requestAnimationFrame(step);
    }

    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([scaleExtent.min, scaleExtent.max])
      .on('start', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (momentumFrameRef.current !== null) {
          cancelAnimationFrame(momentumFrameRef.current);
          momentumFrameRef.current = null;
        }
        lastSampleRef.current = { x: event.transform.x, y: event.transform.y, t: performance.now() };
        velocityRef.current = { vx: 0, vy: 0 };
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
        const sourceType = (event.sourceEvent as Event | undefined)?.type;
        if (sourceType === 'mousemove' || sourceType === 'touchmove') {
          const sample: Sample = { x: event.transform.x, y: event.transform.y, t: performance.now() };
          if (lastSampleRef.current) {
            velocityRef.current = computeVelocity(lastSampleRef.current, sample);
          }
          lastSampleRef.current = sample;
        }
      })
      .on('end', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const sourceType = (event.sourceEvent as Event | undefined)?.type;
        if (sourceType !== 'mouseup' && sourceType !== 'touchend') return;
        runMomentum();
      });
    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(svgRef.current);
    selection.call(zoomBehavior);
    const initial = zoomIdentity.translate(dimensions.width / 2, dimensions.height / 6).scale(initialZoom);
    selection.call(zoomBehavior.transform, initial);
    // dimensions is measured once on mount (see this plan's Global Constraints on why there's
    // no resize handling), so this effect intentionally only re-runs if it changes from null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]);
```

This step introduces a `transformRef` used inside `runMomentum` instead of
the `transform` state directly, so the momentum loop always reads the
*current* scale without needing `transform` in this effect's dependency
array (which would tear down and rebuild the whole zoom behavior on every
pan/zoom tick). Step 3 adds that ref.

- [ ] **Step 3: Add `transformRef`, kept in sync with `transform` state**

Change:

```ts
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: initialZoom });
```

to:

```ts
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: initialZoom });
  const transformRef = useRef(transform);
  transformRef.current = transform;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: PASS, all tests (Task 1's new ones plus everything from prior sub-projects) still green.

- [ ] **Step 6: Production build**

Run: `npm run build`
Expected: succeeds, including prerendering `/genealogy-tree`.

- [ ] **Step 7: Full manual verification in the browser**

Requires `genealogy-api`'s dev server running and a logged-in session
(same setup as prior sub-projects).

Check:
- Toggling a node's `+`/`−` fades the affected subtree in/out rather than
  popping.
- Panning quickly across the ~700-member seeded tree shows a subtle fade
  at the viewport boundary rather than a hard pop (per this spec's
  Non-goals, this is intentionally the same visual treatment as collapse).
- Zoom in/out/reset buttons and selecting a search result ease smoothly
  to their target instead of snapping.
- Dragging the canvas with the mouse tracks the pointer with no lag
  (unaffected by transitions).
- A fast drag-and-release keeps gliding briefly and decelerates smoothly
  to a stop; a slow drag-and-release (low velocity) stops immediately
  with no perceptible coast.
- Starting a new drag while a momentum coast is still running stops the
  coast immediately and follows the new drag.
- A wheel-zoom gesture never triggers a momentum coast.
- No console errors.
- If the coast distance/duration feels off, `FRICTION`/`MIN_SPEED` in
  `src/lib/tree/momentum.ts` are the tunable constants — adjust and
  re-verify rather than treating the current values as final (the spec's
  Non-goals call this out explicitly).

- [ ] **Step 8: Commit**

```bash
git add src/components/tree/TreeCanvas.tsx
git commit -m "feat: add drag momentum to the tree canvas"
```
