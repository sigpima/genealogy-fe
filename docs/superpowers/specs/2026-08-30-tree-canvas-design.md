# Custom Tree Canvas + Viewport Virtualization — Design Spec

Date: 2026-08-30
Status: Approved for implementation planning

## Context

This is sub-project 3a of the four listed in `2026-08-30-tree-lod-design.md`'s
Context (further split into 3a/3b during this round's brainstorming: 3a is
the renderer + virtualization swap; 3b, a later spec, layers expand/collapse,
zoom/pan, and search-center animation on top once 3a is verified working).

`GenealogyTree` (`src/app/genealogy-tree/page.tsx`) currently renders every
*expanded* member as a real SVG `<g>` via `react-d3-tree`, regardless of
whether it's inside the visible viewport. Sub-projects 1 and 2 already cut
per-node render cost (LOD) and per-node fetch cost (lazy detail), but a
large, mostly-expanded tree still creates one SVG element per visible
member — there is no ceiling tied to viewport size. This spec replaces
`react-d3-tree` with a small custom renderer built directly on `d3-hierarchy`
and `d3-zoom` (both already available — `d3` is an existing dependency,
`react-d3-tree` itself is built on the same two packages) that only
creates SVG elements for members inside the current viewport (plus a
buffer), so the on-screen element count is bounded by viewport size, not
tree size.

The exact layout and path formulas below are copied from
`node_modules/react-d3-tree`'s own source
(`Tree/index.js`'s `generateTree`/`centerNode`, `Link/index.js`'s
`drawStepPath`) so the tree's visual shape does not change — this is a
rendering-engine swap, not a redesign. (A related lesson from
`2026-08-30-tree-lod-design.md`'s implementation: `app/genealogy-tree/page.tsx`
is *also* an accidental Next.js route in its own right (any `page.tsx`
under `app/` becomes one), prerendered at build time with no props. The
fix there was guarding `familyTree` before use; here, the fix is keeping
the new canvas component behind the same `next/dynamic(..., { ssr: false })`
wrapper `react-d3-tree` already used, so none of its `d3-zoom`/`d3-select`
code — which needs `window` — runs during that prerender at all.)

## Goals

- Replace `react-d3-tree` with a custom `TreeCanvas` component: same visual
  node shape/spacing/link style, same zoom/pan/expand-collapse/search-center
  *capabilities*, but only rendering members within the current viewport
  (+ a buffer of about one viewport's width/height on each side).
- `TreeCanvas` is domain-agnostic (`FamilyMember`, not "family member" UI
  concepts) — it takes a `renderNode` render-prop for node content, mirroring
  `react-d3-tree`'s `renderCustomNodeElement` prop, so the existing
  avatar/LOD/click-handler JSX in `page.tsx` moves over largely unchanged.
- Expand/collapse state (`collapsedIds`) becomes ours to own (a `Set<number>`
  in `page.tsx`) instead of living inside the library — and, as a side
  effect, now survives a tree refetch after a mutation (an improvement:
  today's collapse state is implicitly library-internal and not something
  this app's data flow preserves across a `data` prop change).
- Remove the `react-d3-tree` dependency once nothing imports it.

## Non-goals

- Any animation (expand/collapse transitions, zoom/pan momentum, animated
  search-center) — that's 3b, built on top of this once verified.
- Changing node visuals, spacing constants, or the step-link style — this
  spec's Goals require them to stay the same; 3b or later work can revisit.
- Windowing/virtualizing the member *detail* data (already handled by
  sub-project 2) or the LOD radius logic (sub-project 1) — both are
  unchanged and unaffected by this spec; they already operate on the full
  logical tree, independent of what's currently on screen.
- Handling container resize after mount — matches today's behavior
  (`page.tsx` currently measures the container once via a ref callback and
  never re-measures; this spec preserves that, not a regression).

## Design

### Layout (`src/lib/tree/layout.ts`)

```ts
import { hierarchy, tree as d3tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { FamilyMember } from './types';

export type TreeNodeSize = { x: number; y: number };
export type TreeSeparation = { siblings: number; nonSiblings: number };
export type TreeLink = { source: HierarchyPointNode<FamilyMember>; target: HierarchyPointNode<FamilyMember> };
export type TreeLayout = { nodes: HierarchyPointNode<FamilyMember>[]; links: TreeLink[] };

export function computeLayout(
  root: FamilyMember,
  collapsedIds: Set<number>,
  nodeSize: TreeNodeSize,
  separation: TreeSeparation
): TreeLayout {
  const layoutTree = d3tree<FamilyMember>()
    .nodeSize([nodeSize.x, nodeSize.y])
    .separation((a, b) => (a.parent === b.parent ? separation.siblings : separation.nonSiblings));
  const rootNode = layoutTree(
    hierarchy(root, (d) => (d.id !== undefined && collapsedIds.has(d.id) ? null : d.children))
  );
  return { nodes: rootNode.descendants(), links: rootNode.links() };
}

export function stepPath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  const deltaY = target.y - source.y;
  return `M${source.x},${source.y} V${source.y + deltaY / 2} H${target.x} V${target.y}`;
}
```

This is the same `d3.tree().nodeSize(...).separation(...)` call
`react-d3-tree` makes internally (`a.parent === b.parent` replaces its
`a.parent.data.__rd3t.id === b.parent.data.__rd3t.id` — equivalent by
reference equality within one `hierarchy()` call, simpler). `stepPath` is
`Link/index.js`'s `drawStepPath` for the vertical orientation, verbatim
(this app never uses horizontal orientation, so only that branch is
ported). A node's `x` is its horizontal position, `y` its depth — same
convention, so the existing `nodeSize={x:250,y:150}` and
`separation={siblings:0.8,nonSiblings:1.5}` constants carry over unchanged.

### Viewport filtering (`src/lib/tree/viewport.ts`)

```ts
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
  const inRect = (p: { x: number; y: number }) => p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1;
  return links.filter((l) => inRect(l.source) || inRect(l.target));
}
```

`transform` is a d3-zoom `ZoomTransform`-shaped value (`{x, y, k}`): a tree
node at local coordinates `(x, y)` renders on screen at
`(x*k + transform.x, y*k + transform.y)`. `visibleRect` inverts that to get
the tree-space rectangle currently visible, expanded by one viewport width/
height on each side (the buffer decided in this round's brainstorming) —
expanding the *screen*-space rect before inverting means the buffer scales
correctly with zoom level automatically. A link renders if either endpoint
is in the (buffered) visible rect — with `nodeSize` this small relative to
any reasonable buffer, a link with both endpoints just outside it is not a
real-world case worth handling.

### `TreeCanvas` (`src/components/tree/TreeCanvas.tsx`)

Domain-agnostic. Props:

```ts
export type TreeCanvasProps = {
  familyTree: FamilyMember;
  collapsedIds: Set<number>;
  nodeSize: TreeNodeSize;
  separation: TreeSeparation;
  scaleExtent: { min: number; max: number };
  initialZoom: number;
  renderNode: (node: HierarchyPointNode<FamilyMember>, hasChildren: boolean, isCollapsed: boolean) => React.ReactNode;
};

export type TreeCanvasHandle = {
  centerOnNode: (id: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};
```

Internally: an SVG ref + an inner `<g>` ref that `d3-zoom` drives. On mount,
`d3.zoom().scaleExtent([scaleExtent.min, scaleExtent.max]).on('zoom', (event) => setTransform(event.transform))`
is attached to the SVG selection (`d3.select(svgRef.current).call(zoom)`),
mirroring how `react-d3-tree` and its own `centerNode` already use
`d3-zoom` internally (confirmed by reading its source — this isn't a novel
pattern for this codebase's dependency tree, just no longer hidden inside
a library). `transform` is component state, initialized once on mount from
the measured container size (same `{x: rect.width/2, y: rect.height/6}`,
`initialZoom` starting scale as today).

Render: `computeLayout(familyTree, collapsedIds, nodeSize, separation)`
(memoized on `[familyTree, collapsedIds, nodeSize, separation]` — the
"expensive, rare" tier), then `visibleRect` + `filterVisibleNodes`/
`filterVisibleLinks` against the current `transform` and measured
dimensions (memoized on `[layout, transform, dimensions]` — the "cheap,
frequent" tier, recomputed on every zoom/pan tick but doing only bounds
comparisons, no SVG work). Only the filtered nodes/links become `<g>`/
`<path>` elements, keyed by `node.data.id` / `` `${source.data.id}-${target.data.id}` ``.
Each visible node's content comes from calling the `renderNode` prop.

`centerOnNode(id)` looks up the node in the *full* layout (not the visible
subset — the target may currently be off-screen), keeps the current scale
`k`, and sets `transform = {x: width/2 - node.x*k, y: height/2 - node.y*k, k}`
via `d3.select(svgRef.current).call(zoom.transform, d3.zoomIdentity.translate(...).scale(k))`
— the same math `react-d3-tree`'s own `centerNode` uses (confirmed from its
source), just without a transition (3b adds that). `zoomIn`/`zoomOut`/
`resetView` similarly drive the same `zoom` behavior's imperative API
(`zoom.scaleBy`, `zoom.transform`) instead of `page.tsx` computing a new
zoom number by hand.

**Must stay behind `next/dynamic(..., { ssr: false })`** in `page.tsx`,
exactly where `react-d3-tree`'s `Tree` import is today — see this spec's
Context for why (the accidental `/genealogy-tree` route's build-time
prerender has no `familyTree` prop, and `TreeCanvas` touches `window` via
`d3-select`/`d3-zoom`, both reasons this must never render during SSR).

### `page.tsx` changes

- Drop the `react-d3-tree` import, `dynamic(() => import('react-d3-tree'))`,
  and its types (`CustomNodeElementProps`, `TreeNodeDatum`, the derived
  `HierarchyPointNodeOf`). Replace with `dynamic(() => import('@/components/tree/TreeCanvas'))`
  and `HierarchyPointNode<FamilyMember>` from `d3-hierarchy`.
- New state: `const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())`
  — not reset on `familyTree` changes (the improvement noted in Goals).
- `renderNode`'s JSX body (rect, avatar/initial via `detailsById`, name
  text, `+`/`−` toggle) is unchanged content-wise; only its signature
  changes to match `TreeCanvasProps['renderNode']`, and the toggle's
  `onClick` now does `setCollapsedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })`
  plus the existing `setFocalId(id)` call, instead of calling `toggleNode()`.
- `handleNodeClick` keys off `node.data.id`/`node.data.name` directly
  (no `nodeDatum`/`hierarchyPointNode` split — `TreeCanvas` only ever
  deals in `HierarchyPointNode<FamilyMember>`).
- The `focusRequest` effect calls `canvasRef.current.centerOnNode(id)`
  (found via `findMembersByName`/existing path-lookup logic locating the
  member's `id`, unchanged) instead of `generateTree()` + manual
  `arraysEqual(path, ...)` matching — `centerOnNode` takes an id directly,
  so the path-matching dance `react-d3-tree`'s opaque node objects required
  is no longer needed.
- `TreeControls`' zoom in/out/reset handlers call
  `canvasRef.current.zoomIn()` / `.zoomOut()` / `.resetView()`.

### Cleanup

`npm uninstall react-d3-tree` once no file imports it. `@types/d3`,
`@types/d3-hierarchy`, `@types/d3-selection`, `@types/d3-shape`, and `d3`
itself stay (now genuinely used directly, not just transitively via
`react-d3-tree`).

## Testing plan

- `computeLayout`: a small fixture tree — verify node count/positions match
  hand-computed `d3.tree()` output for a simple case, verify a collapsed
  node's descendants are excluded from both `nodes` and `links`, verify
  `x`/`y` assignment convention (root at `y=0`, children at increasing `y`).
- `stepPath`: given fixed source/target points, exact string match against
  the hand-verified formula.
- `visibleRect`: given a transform/dimensions/margin, exact rectangle
  bounds (including a `k !== 1` case, since scale affects the inversion).
- `filterVisibleNodes`/`filterVisibleLinks`: nodes/links just inside vs.
  just outside the rect boundary; a link with only one endpoint inside is
  still included.
- Manual verification (no e2e, consistent with prior sub-projects): run
  `npm run dev`, confirm the tree looks visually identical to before
  (same node positions, same step-angled connecting lines); confirm zoom
  in/out/reset, expand/collapse, node click (detail panel), and name
  search-and-center all still work; using devtools, confirm the rendered
  SVG `<g>`/`<path>` count stays roughly constant (bounded by viewport)
  while panning around the ~700-member seeded tree at a normal zoom level,
  instead of scaling with total member count.

## File structure (new/changed)

```
genealogy-web/
  package.json                              # modified: remove react-d3-tree
  src/
    lib/tree/
      layout.ts                               # new: computeLayout, stepPath
      layout.test.ts                            # new
      viewport.ts                                 # new: visibleRect, filterVisibleNodes/Links
      viewport.test.ts                              # new
    components/tree/
      TreeCanvas.tsx                                 # new
    app/genealogy-tree/
      page.tsx                                         # modified: TreeCanvas instead of react-d3-tree, collapsedIds state
```
