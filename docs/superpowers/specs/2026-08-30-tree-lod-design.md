# Tree Level-of-Detail by Depth — Design Spec

Date: 2026-08-30
Status: Approved for implementation planning

## Context

`GenealogyTree` (`src/app/genealogy-tree/page.tsx`) renders the whole family
tree with `react-d3-tree`, one SVG `<g>` per member via a custom
`renderNode`. Every node — regardless of how deep it is or whether the user
is currently looking at it — draws the same content: a rounded rect, either
an avatar `<image>` behind a `<clipPath>` or a fallback initial `<circle>` +
`<text>`, the name, and (if it has children) a +/- toggle affordance. There
is no pagination, virtualization, or lazy loading anywhere in the stack —
`GET /api/members/tree` returns the entire tree in one response, and every
member the response contains gets a full node render if its ancestors are
expanded. On a large, mostly-expanded tree this becomes the dominant cost
(SVG element count and `clipPath`/`image` decode per node) and produces
visible lag on pan/zoom/expand.

This is the first of four planned sub-projects to address that lag, taken
in this order because each later one depends less on the others being
done first:

1. **This spec** — reduce per-node render cost for members far from where
   the user is currently focused.
2. Lazy-load tree branches from the API instead of fetching the whole tree
   at once (reduces initial payload size and total in-memory node count).
3. Replace `react-d3-tree` with a purpose-built renderer that only draws
   nodes inside the current viewport (removes the SVG-node-count ceiling
   entirely).
4. A new "view ancestors N generations back" feature, built on top of the
   above.

This spec only covers (1). It does not reduce the number of members
fetched or held in memory, and it does not change `react-d3-tree`'s layout
engine — those are (2) and (3).

## Goals

- Members within 3 hops of a "focal" node (the member the user last
  interacted with) render with full detail (avatar/initial + name).
- Members farther than 3 hops render name-only: no avatar `<image>`, no
  `<clipPath>`, no fallback initial `<circle>` — just the name `<text>`
  (still inside the same rect, still keeping its +/- expand/collapse
  affordance if it has children).
- "Hops" means graph distance in the family tree treating parent-child
  edges as undirected, so the radius extends both to a focal node's
  ancestors and its descendants.
- The focal node updates when the user clicks a node's expand/collapse
  toggle, or when a search result is selected (both already-existing
  interaction points). Panning and zooming never trigger a recompute.
- The distance computation is a pure, `react-d3-tree`-independent function
  so sub-project (3) can reuse it verbatim when the renderer is replaced,
  and sub-project (4) can reuse it for ancestor-direction radii.

## Non-goals

- Reducing the initial fetch size or total in-memory node count (sub-project 2).
- Viewport-based virtualization / not rendering off-screen nodes at all
  (sub-project 3).
- Making the radius user-configurable or density-adaptive — fixed at 3,
  changeable later by editing one constant if it proves wrong in practice.
- Changing `nodeSize`/layout spacing for name-only nodes — `react-d3-tree`
  sizes every node identically regardless of content; name-only nodes
  occupy the same layout slot as full nodes, just draw less inside it.

## Architecture

### Distance computation

New `src/lib/tree/lod.ts`, following the existing pure-function style in
`src/lib/tree/search.ts`:

```
export function computeDetailSet(root: FamilyMember, focalId: number, radius = 3): Set<number>
```

Builds an adjacency map (`Map<id, id[]>`) from the tree in one pass
(parent-child edges added in both directions), then does a breadth-first
search from `focalId` outward `radius` hops, collecting visited ids into
the returned set. If `focalId` isn't present in the tree (e.g. stale state
right after a delete), it falls back to `root.id` as the BFS start.

### Focal node tracking

`GenealogyTree` gains `const [focalId, setFocalId] = useState<number | null>(null)`,
treated as "unset → use the tree root" wherever it's read. It's updated in
exactly two places, both already-existing handlers:

- The expand/collapse toggle's `onClick` in `renderNode` (currently just
  calls `toggleNode()`) also calls `setFocalId(data.id)`.
- The `focusRequest` effect (search-select → `centerNode`) also calls
  `setFocalId` with the matched node's `id`.

`detailSet` is derived with `useMemo(() => computeDetailSet(familyTree,
focalId ?? familyTree.id ?? -1, RADIUS), [familyTree, focalId])` (the `-1`
fallback is unreachable in practice — the API always sets root `id` — and
`computeDetailSet` itself falls back to `root.id` when the id it's given
isn't found) so `detailSet` is only recomputed when the tree data or the
focal node actually changes, not on every render triggered by pan/zoom's
`onUpdate`.

### Node rendering split

`renderNode` checks `detailSet.has(data.id)`:

- **In set (detailed):** unchanged — today's rect + avatar/initial + name
  + toggle affordance.
- **Not in set (minimal):** same rect and toggle affordance, but the
  avatar `<image>`/`<clipPath>`/fallback `<circle>` block is skipped
  entirely; only the name `<text>` is drawn.

## Testing

Unit tests for `computeDetailSet` in `src/lib/tree/lod.test.ts` (Vitest,
already set up per the frontend-redesign spec), using a small fixture
tree: correct hop counting in both directions from an interior focal node,
correct boundary behavior at exactly `radius` hops, and the fallback when
`focalId` doesn't exist in the tree.

Manual verification: run `next dev`, load a deeply-seeded tree, expand
several generations down, confirm nodes beyond 3 hops from the
last-toggled node render name-only, and confirm selecting a deep search
result re-centers the detailed radius around it.

## File structure (new/changed)

```
src/
  lib/tree/
    lod.ts          # new: computeDetailSet
    lod.test.ts     # new: Vitest unit tests
  app/genealogy-tree/
    page.tsx        # modified: focalId state, detailSet memo, renderNode split, toggle/focusRequest wiring
```
