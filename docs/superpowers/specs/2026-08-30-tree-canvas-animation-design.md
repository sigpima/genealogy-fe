# Tree Canvas Animation (3b) — Design Spec

Date: 2026-08-30
Status: Approved for implementation planning

## Context

This is sub-project 3b, the animation layer on top of `TreeCanvas`
(`2026-08-30-tree-canvas-design.md`, sub-project 3a — the
viewport-virtualized `react-d3-tree` replacement, already implemented and
verified). 3a deliberately deferred all animation (its Non-goals). This
spec adds three things decided in this round's brainstorming: animated
expand/collapse, eased programmatic zoom/pan (buttons, search-center), and
drag momentum.

`framer-motion`/`motion` are already `package.json` dependencies but
**unused anywhere in the codebase** (confirmed by search — leftover from
the original scaffold). This is their first real use, chosen specifically
for expand/collapse because `AnimatePresence` handles "animate an element
out, then remove it from the DOM" — awkward to hand-roll in React, since
React wants to unmount immediately on a list change.

A specific interaction with 3a's virtualization: `TreeCanvas` continuously
adds/removes rendered nodes as the buffered viewport rectangle changes
during panning, not only when `collapsedIds` changes. `AnimatePresence`
animating a node's mount/unmount can't distinguish "this node's ancestor
was just collapsed" from "this node just panned outside the buffer" — and
per this round's decision, it doesn't try to: both get the same short
fade. This matches how virtualized lists elsewhere commonly soften their
viewport boundary (a subtle fade rather than a hard pop), so it reads as
consistent behavior rather than a missing distinction.

## Goals

- Nodes and links fade in/out (~150–200ms) when they enter or leave the
  rendered set, for any reason (collapse/expand or panning across the
  viewport buffer).
- `zoomIn`, `zoomOut`, `resetView`, `centerOnNode` (`TreeCanvasHandle`)
  animate via `d3-transition` (already available — same package as the
  `d3-zoom`/`d3-hierarchy` 3a already depends on) instead of snapping
  instantly, matching the easing `react-d3-tree`'s own `centerNode` used
  (confirmed from its source during 3a).
- Releasing a mouse/touch drag with velocity continues panning and decays
  to a stop (real inertia, not just "feels responsive") — matching
  familiar map/design-tool drag behavior.
- Live pointer dragging itself stays untransitioned (1:1 with the pointer,
  no lag) — easing only applies to programmatic transform changes and to
  the momentum coast after release.
- Momentum only follows a mouse/touch drag release, never a wheel-zoom
  gesture.

## Non-goals

- Distinguishing collapse-driven removal from viewport-driven removal for
  animation purposes — both fade the same way, per this spec's Context.
- Momentum for zoom (pinch/wheel) — only pan (translate) gets inertia.
- Configurable animation durations/friction via UI — constants in code,
  tunable later if they feel wrong in practice.
- Any change to 3a's layout, virtualization filtering, or LOD/lazy-detail
  integration — this spec only adds animation on top.

## Design

### Expand/collapse and viewport-boundary fade

In `TreeCanvas.tsx`, wrap the node/link map output in `AnimatePresence`
and each item in `motion.g`/`motion.path`, keyed the same way as today
(`node.data.id`, `` `${source.data.id}-${target.data.id}` ``):

```tsx
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      transform={`translate(${node.x},${node.y})`}
    >
      {renderNode(node)}
    </motion.g>
  ))}
</AnimatePresence>
```

(`motion.g`/`motion.path` render real `<g>`/`<path>` elements with
Framer's animation wired in — no DOM-shape change from 3a's plain `<g>`/
`<path>`.) No per-node "why is this changing" logic — `AnimatePresence`
just reacts to the filtered list changing, from either cause, per the
Non-goals.

### Eased programmatic zoom/pan

`TreeCanvasHandle`'s four imperative methods currently call
`select(svgRef.current).call(zoomBehavior.transform, next)` (an instant
set). Each becomes a transition:

```ts
select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, next);
```

(`.scaleBy` similarly for `zoomIn`/`zoomOut`.) Live pointer-driven zoom/pan
(the existing `.on('zoom', ...)` handler reacting to drag/wheel) is
unaffected — it already only fires from real pointer/wheel events, never
from these four methods, so it was never going through `.transition()` and
still won't be.

### Drag momentum

A new pure module, `src/lib/tree/momentum.ts`:

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

`TreeCanvas` keeps a ref-held last `{x, y, t}` sample. Its `.on('zoom', ...)`
handler, whenever `event.sourceEvent` is a `mousemove`/`touchmove` (a real
drag tick, not a wheel event or a `.transition()`-driven call, which have
no `sourceEvent`/a different type), calls `computeVelocity` against the
previous sample and stores the result alongside the new sample. Its
`.on('end', ...)` handler checks `event.sourceEvent?.type` — only
`mouseup`/`touchend` triggers momentum; a wheel-end or a `.transition()`
completing does not. If `isMomentumDone` is already true for the last
tracked velocity, nothing happens (no perceptible flick, no coast).
Otherwise, a `requestAnimationFrame` loop runs: each frame,
`zoomBehavior.translateBy(selection, vx*dt, vy*dt)` (using the real
frame's `dt`, not a fixed step) then `nextMomentumStep`, stopping once
`isMomentumDone`. This loop uses the *same* `zoomBehavior.translateBy` — so
each frame still fires `.on('zoom', ...)`, keeping `transform` state (and
therefore the visible-node filter) in sync exactly like a real drag would.

## Testing plan

- `computeVelocity`: two samples with a known `dt` produce the expected
  `vx`/`vy`; a zero/negative `dt` (defensive — shouldn't happen with real
  timestamps, but a duplicate-timestamp event is plausible) returns zero
  rather than dividing by zero or going negative-infinite.
- `nextMomentumStep`: applies `FRICTION` exactly.
- `isMomentumDone`: below/above `MIN_SPEED` boundary, using the 3-4-5
  triangle (e.g. `vx=3,vy=4` → speed `5`) to make the expected boundary
  obvious without float fuzziness.
- Manual verification (no automated UI/animation test — consistent with
  prior sub-projects, and animation timing isn't practically assertable
  without a browser): run `npm run dev`, confirm expand/collapse fades
  instead of popping; confirm zoom buttons and a search-center both ease
  in rather than snapping; confirm a fast drag-and-release keeps gliding
  and decelerates to a stop; confirm a wheel-zoom never triggers momentum;
  confirm a live drag itself still tracks the pointer with no added lag.

## File structure (new/changed)

```
genealogy-web/
  src/
    lib/tree/
      momentum.ts          # new: computeVelocity, nextMomentumStep, isMomentumDone
      momentum.test.ts       # new
    components/tree/
      TreeCanvas.tsx            # modified: AnimatePresence/motion.g/motion.path,
                                 #   transitioned imperative methods, momentum loop
```
