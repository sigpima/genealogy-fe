# Ancestor View (view N generations back) — Design Spec

Date: 2026-08-30
Status: Approved for implementation planning

## Context

This is sub-project 4, the last of the four listed in
`2026-08-30-tree-lod-design.md`'s Context — the original feature request
this whole initiative started from ("I want to see my origins from 4
generations back"). Unlike sub-projects 1-3, it's a new user-facing
feature rather than a performance fix, but it lands after the performance
work specifically because it can now be built almost entirely by reusing
what those sub-projects already produced: `Home` (`src/app/page.tsx`)
already fetches the whole (lightweight, skeleton-only) family tree once;
`TreeCanvas` already renders whatever `FamilyMember` subtree it's given,
with no assumption that it must be the absolute genealogical root.

"Viewing N generations back" therefore reduces to: find the member's
ancestor 4 generations up (walking the already-loaded tree), and tell
`TreeCanvas` to render *that* member's subtree instead of the whole
tree's. No backend change, no new fetch — everything needed is already
in memory client-side.

## Goals

- A "Xem tổ tiên 4 đời" ("View ancestors, 4 generations") button in
  `MemberDetailPanel`, shown only when the member has at least one
  ancestor. Clicking it re-roots the tree view at their ancestor 4
  generations up — showing that ancestor's full subtree (the direct
  line back to the selected member, plus every sibling/cousin branch
  along the way — the richer of the two options considered, and, as it
  turns out, no harder to build than the leaner one since re-rooting
  naturally includes everything under the new root).
- If the member has fewer than 4 generations of ancestors, the view
  roots at the actual topmost ancestor instead (no error, no disabled
  button for members close to the root — the button always works).
- The camera centers on the originally-selected member (not the new
  root) after switching, so the person the user asked about stays the
  visual anchor.
- A small persistent "Xem toàn bộ cây gia phả" ("View the whole family
  tree") control appears while in this mode, to return to the normal
  full-tree view.
- Selecting a name-search result always searches and centers against the
  *whole* tree, exiting ancestor-view mode first if it was active — so
  search never appears to "fail" because the match is outside the
  currently-rooted subtree.
- Re-clicking "Xem tổ tiên 4 đời" while already in ancestor-view mode
  (from a different selected member) works the same way, computed fresh
  from the whole tree each time — not relative to whatever subtree is
  currently displayed.

## Non-goals

- Any backend change — this is 100% client-side, reusing the already
  in-memory skeleton tree from sub-project 2.
- A configurable N (fixed at 4, per this round's decision) or a
  standalone name+N input UI (the panel button, per this round's
  decision).
- Preserving `collapsedIds` (expand/collapse state) across a root switch
  — switching roots is enough of a context change that starting the new
  subtree fully expanded (today's existing default) is the simpler,
  more predictable behavior. Not explicitly resetting it either, since
  collapse state is keyed by member id and largely irrelevant once the
  rendered subtree changes shape.
- Deep-linking to (or persisting) the current ancestor-view root across
  a page reload — it's session-local UI state, same as `collapsedIds`
  and `focalId` already are.

## Design

### `findAncestorChainById` (`src/lib/tree/search.ts`)

```ts
export function findAncestorChainById(root: FamilyMember, id: number): FamilyMember[] | null {
  function walk(node: FamilyMember, chain: FamilyMember[]): FamilyMember[] | null {
    const nextChain = [...chain, node];
    if (node.id === id) return nextChain;
    for (const child of node.children ?? []) {
      const found = walk(child, nextChain);
      if (found) return found;
    }
    return null;
  }
  return walk(root, []);
}
```

Returns the actual member objects from the tree root to the target
(inclusive), not names — deliberately not reusing `findPathToMember`'s
name-based matching, since this app's real seeded data already has
members sharing a name (confirmed while verifying sub-project 1); an
id-keyed walk has no such ambiguity. `GenealogyTree` computes the switch
target as `chain[Math.max(0, chain.length - 1 - 4)]` — index `0` is the
tree's absolute root, so this naturally clamps to it when there are
fewer than 4 ancestor generations above the target.

### View-root state (`src/app/genealogy-tree/page.tsx`)

`GenealogyTree` gains `const [ancestorViewRootId, setAncestorViewRootId] = useState<number | null>(null)`
— no prop or `Home` change needed. The subtree actually handed to
`TreeCanvas` is derived, not stored directly (so it can't go stale after
a refetch replaces `familyTree` with a new object graph following any
mutation):

```ts
const displayRoot = useMemo(() => {
  if (ancestorViewRootId === null) return familyTree;
  const chain = findAncestorChainById(familyTree, ancestorViewRootId);
  return chain ? chain[chain.length - 1] : familyTree;
}, [familyTree, ancestorViewRootId]);
```

(Storing the *id* and re-deriving the node from the current `familyTree`
handles a refetch correctly; storing the node object directly would not
— a stale reference from a superseded tree.)

A new handler, called from the panel's new button:

```ts
function handleViewAncestors(memberId: number) {
  const chain = findAncestorChainById(familyTree, memberId);
  if (!chain) return;
  const ancestor = chain[Math.max(0, chain.length - 1 - 4)];
  if (ancestor.id === undefined) return;
  setAncestorViewRootId(ancestor.id);
  setFocalId(memberId);
  setSelectedMember(null);
  requestAnimationFrame(() => canvasRef.current?.centerOnNode(memberId));
}
```

(`requestAnimationFrame` because `displayRoot`/`collapsedIds`-driven
layout needs to update — new root, everything expanded — before
`centerOnNode` can find the target member in `TreeCanvas`'s freshly
recomputed layout; a same-tick call would look up the *old* layout.)

Exiting: `setAncestorViewRootId(null)`, exposed via a small button
rendered (inside the same relatively-positioned container as
`TreeCanvas`) only when `ancestorViewRootId !== null`.

The `focusRequest` effect (search-driven centering) exits ancestor-view
mode first:

```ts
useEffect(() => {
  if (!focusRequest || !canvasRef.current) return;
  setAncestorViewRootId(null);
  requestAnimationFrame(() => {
    canvasRef.current?.centerOnNode(focusRequest.id);
  });
  setHighlightedName(focusRequest.name);
  setFocalId(focusRequest.id);
  const timer = setTimeout(() => setHighlightedName(null), 2000);
  return () => clearTimeout(timer);
}, [focusRequest]);
```

(Same `requestAnimationFrame` reasoning: if ancestor-view was active,
`displayRoot` must switch back to the full tree and `TreeCanvas` must
recompute its layout before `centerOnNode` can find a member that might
not have been part of the previously-displayed subtree at all.)

### `MemberDetailPanel` button

New prop `onViewAncestors: () => void`. A button placed next to the
ancestor breadcrumb (`{ancestors.length > 0 && ...}` — the same condition
already gates whether there's a breadcrumb to show, and is exactly "does
this member have at least one ancestor"), calling
`onViewAncestors` — `page.tsx` wires this to
`() => handleViewAncestors(selectedMember.id)`. Not gated on
`isDetailLoading`/`detailLoadError` (it only needs the id, already known
from the skeleton the moment the panel opens).

## Testing plan

- `findAncestorChainById`: returns the full root-to-target chain for a
  normal case; returns `null` for a nonexistent id; on a fixture with
  two same-named members at different positions, returns the chain for
  the correct one by id (the scenario `findPathToMember` can't
  disambiguate).
- Manual verification (no automated UI test, consistent with prior
  sub-projects): click "Xem tổ tiên 4 đời" on a deep member in the
  seeded tree, confirm the view re-roots and centers on that member with
  their ancestor line and siblings/cousins visible; click it on a member
  within 1-3 generations of the root, confirm it clamps to the real
  root rather than erroring; click "Xem toàn bộ cây gia phả" to confirm
  it returns to the full tree; while in ancestor-view mode, search for
  and select a member outside the current subtree, confirm it exits
  ancestor-view mode and centers correctly instead of silently failing.

## File structure (new/changed)

```
genealogy-web/
  src/
    lib/tree/
      search.ts               # modified: + findAncestorChainById
      search.test.ts            # modified: + tests
    app/genealogy-tree/
      page.tsx                    # modified: ancestorViewRootId, displayRoot,
                                   #   handleViewAncestors, exit control, focusRequest update
    components/tree/
      MemberDetailPanel.tsx           # modified: onViewAncestors prop + button
```
