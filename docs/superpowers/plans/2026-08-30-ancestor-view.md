# Ancestor View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Xem tổ tiên 4 đời" button to the member detail panel that re-roots the tree view at that member's ancestor 4 generations up (clamped to the real root if there are fewer), entirely client-side.

**Architecture:** A pure `findAncestorChainById` walk in `search.ts` locates the id-keyed root-to-target chain within the already-loaded skeleton tree. `GenealogyTree` derives a `displayRoot` from a new `ancestorViewRootId` state (re-resolved from the live `familyTree` on every render, so it can't go stale across a refetch) and hands that to `TreeCanvas` instead of the absolute root. A small exit control and an updated search-centering effect round out entering/leaving the mode.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest (existing setup). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-30-ancestor-view-design.md`

**Depends on:** Sub-projects 1-3 (already implemented) — this plan builds on `GenealogyTree`/`TreeCanvas`/`MemberDetailPanel`'s current state.

## Global Constraints

- No backend changes — entirely client-side, per the spec's Non-goals.
- The ancestor generation count is fixed at 4 — not user-configurable.
- `collapsedIds` is not explicitly reset when the view root changes — per the spec's Non-goals, this is deliberate (not an oversight to fix later).
- `npx tsc --noEmit`, `npm run test`, and `npm run build` must all pass after every task.

---

## File Structure

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

---

### Task 1: `findAncestorChainById` (TDD)

**Files:**
- Modify: `src/lib/tree/search.ts`, `src/lib/tree/search.test.ts`

**Interfaces:**
- Produces: `findAncestorChainById(root: FamilyMember, id: number): FamilyMember[] | null`, exported from `src/lib/tree/search.ts`, imported by Task 2 as `import { findAncestorChainById, ... } from '@/lib/tree/search'`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/tree/search.test.ts` (adjust the import line to include `findAncestorChainById`):

```ts
import {
  findAncestorChainById,
  findMembersByName,
  findPathToMember,
  generationOf,
  getMemberAtPath,
  getReparentCandidates,
} from './search';
```

Add a new fixture and describe block (place near the existing fixture/tests):

```ts
const duplicateNameTree: FamilyMember = {
  id: 1,
  name: 'root',
  children: [
    {
      id: 2,
      name: 'dup',
      children: [{ id: 4, name: 'dup' }],
    },
    { id: 3, name: 'other' },
  ],
};

describe('findAncestorChainById', () => {
  it('returns the root-to-target chain of member objects', () => {
    const chain = findAncestorChainById(duplicateNameTree, 4);
    expect(chain?.map((m) => m.id)).toEqual([1, 2, 4]);
  });

  it('returns null for a nonexistent id', () => {
    expect(findAncestorChainById(duplicateNameTree, 999)).toBeNull();
  });

  it('disambiguates same-named members by id', () => {
    const chain = findAncestorChainById(duplicateNameTree, 2);
    expect(chain?.map((m) => m.id)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- search`
Expected: FAIL — `findAncestorChainById` is not exported from `./search`.

- [ ] **Step 3: Implement `findAncestorChainById`**

In `src/lib/tree/search.ts`, add (near `findPathToMember`, which it parallels):

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- search`
Expected: PASS (all `search.ts` tests, including the 3 new ones).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tree/search.ts src/lib/tree/search.test.ts
git commit -m "feat: add findAncestorChainById for the ancestor view feature"
```

---

### Task 2: Wire the ancestor view into the tree page and detail panel

**Files:**
- Modify: `src/components/tree/MemberDetailPanel.tsx`, `src/app/genealogy-tree/page.tsx`

**Interfaces:**
- Consumes: `findAncestorChainById` (Task 1).

- [ ] **Step 1: Add `onViewAncestors` to `MemberDetailPanelProps` and its destructure**

In `src/components/tree/MemberDetailPanel.tsx`, change:

```ts
  isDetailLoading: boolean;
  detailLoadError: boolean;
  onRetryLoadDetail: () => void;
  onClose: () => void;
```

to:

```ts
  isDetailLoading: boolean;
  detailLoadError: boolean;
  onRetryLoadDetail: () => void;
  onViewAncestors: () => void;
  onClose: () => void;
```

Change:

```ts
  isDetailLoading,
  detailLoadError,
  onRetryLoadDetail,
  onClose,
```

to:

```ts
  isDetailLoading,
  detailLoadError,
  onRetryLoadDetail,
  onViewAncestors,
  onClose,
```

- [ ] **Step 2: Add the button next to the ancestor breadcrumb**

Change:

```tsx
      {ancestors.length > 0 && <p className="mt-4 text-xs text-muted">{ancestors.join(' → ')}</p>}
```

to:

```tsx
      {ancestors.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted">{ancestors.join(' → ')}</p>
          <button
            type="button"
            onClick={onViewAncestors}
            className="mt-1 text-xs accent-text hover:underline"
          >
            Xem tổ tiên 4 đời
          </button>
        </div>
      )}
```

- [ ] **Step 3: Typecheck (expect a failure — the caller isn't updated yet)**

Run: `npx tsc --noEmit`
Expected: FAIL — `src/app/genealogy-tree/page.tsx`'s `<MemberDetailPanel ... />` call is missing the now-required `onViewAncestors` prop. Steps 4-8 fix this.

- [ ] **Step 4: Add `ancestorViewRootId` state and the derived `displayRoot`**

In `src/app/genealogy-tree/page.tsx`, change:

```ts
import { getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
```

to:

```ts
import { findAncestorChainById, getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
```

Change:

```ts
export default function GenealogyTree({ familyTree, focusRequest, onDataChanged }: GenealogyTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
```

to:

```ts
export default function GenealogyTree({ familyTree, focusRequest, onDataChanged }: GenealogyTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [ancestorViewRootId, setAncestorViewRootId] = useState<number | null>(null);
  const displayRoot = useMemo(() => {
    if (ancestorViewRootId === null) return familyTree;
    const chain = findAncestorChainById(familyTree, ancestorViewRootId);
    return chain ? chain[chain.length - 1] : familyTree;
  }, [familyTree, ancestorViewRootId]);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
```

- [ ] **Step 5: Add `handleViewAncestors` and update the `focusRequest` effect to exit ancestor-view mode**

Change:

```ts
  useEffect(() => {
    if (!focusRequest || !canvasRef.current) return;
    canvasRef.current.centerOnNode(focusRequest.id);
    setHighlightedName(focusRequest.name);
    setFocalId(focusRequest.id);
    const timer = setTimeout(() => setHighlightedName(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRequest]);
```

to:

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

  function handleViewAncestors(memberId: number) {
    const chain = findAncestorChainById(familyTree, memberId);
    if (!chain) return;
    const ancestor = chain[Math.max(0, chain.length - 1 - 4)];
    if (ancestor.id === undefined) return;
    setAncestorViewRootId(ancestor.id);
    setFocalId(memberId);
    setSelectedMember(null);
    requestAnimationFrame(() => {
      canvasRef.current?.centerOnNode(memberId);
    });
  }
```

- [ ] **Step 6: Pass `displayRoot` to `TreeCanvas` and add the exit control**

Change:

```tsx
  return (
    <div className="relative h-full w-full overflow-hidden bg-app">
      <TreeCanvas
        ref={canvasRef}
        familyTree={familyTree}
        collapsedIds={collapsedIds}
        nodeSize={NODE_SIZE}
        separation={SEPARATION}
        scaleExtent={SCALE_EXTENT}
        initialZoom={INITIAL_ZOOM}
        renderNode={renderNode}
      />
      <TreeControls
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onReset={() => canvasRef.current?.resetView()}
      />
```

to:

```tsx
  return (
    <div className="relative h-full w-full overflow-hidden bg-app">
      <TreeCanvas
        ref={canvasRef}
        familyTree={displayRoot}
        collapsedIds={collapsedIds}
        nodeSize={NODE_SIZE}
        separation={SEPARATION}
        scaleExtent={SCALE_EXTENT}
        initialZoom={INITIAL_ZOOM}
        renderNode={renderNode}
      />
      {ancestorViewRootId !== null && (
        <button
          type="button"
          onClick={() => setAncestorViewRootId(null)}
          className="absolute left-4 top-4 z-30 rounded-lg border-default border bg-surface px-3 py-1.5 text-sm text-default shadow-md hover:bg-app"
        >
          Xem toàn bộ cây gia phả
        </button>
      )}
      <TreeControls
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onReset={() => canvasRef.current?.resetView()}
      />
```

- [ ] **Step 7: Pass `onViewAncestors` to `MemberDetailPanel`**

Change:

```tsx
          isDetailLoading={selectedMember.isDetailLoading}
          detailLoadError={selectedMember.detailLoadError}
          onRetryLoadDetail={handleRetryLoadDetail}
          childMembers={selectedMember.childrenNames.map((childName) => ({
```

to:

```tsx
          isDetailLoading={selectedMember.isDetailLoading}
          detailLoadError={selectedMember.detailLoadError}
          onRetryLoadDetail={handleRetryLoadDetail}
          onViewAncestors={() => handleViewAncestors(selectedMember.id)}
          childMembers={selectedMember.childrenNames.map((childName) => ({
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 9: Run the test suite**

Run: `npm run test`
Expected: PASS, all tests (Task 1's new ones plus everything from prior sub-projects) still green.

- [ ] **Step 10: Production build**

Run: `npm run build`
Expected: succeeds, including prerendering `/genealogy-tree`.

- [ ] **Step 11: Manual verification in the browser**

Requires `genealogy-api`'s dev server running and a logged-in session
(same setup as prior sub-projects).

Check:
- Open a deep member's detail panel (several generations from the root)
  and click "Xem tổ tiên 4 đời" — the tree re-roots at their ancestor 4
  generations up, camera centers on the originally-selected member, and
  their ancestor line plus siblings/cousins along the way are visible.
- Open a member within 1-3 generations of the root and click the same
  button — it clamps to the real root instead of erroring.
- The "Xem toàn bộ cây gia phả" control appears while in this mode and
  returns to the full tree when clicked.
- While in ancestor-view mode, search for and select a member outside
  the currently-displayed subtree — confirm it exits ancestor-view mode
  and centers on the match instead of silently failing to find it.
- No console errors.

- [ ] **Step 12: Commit**

```bash
git add src/components/tree/MemberDetailPanel.tsx src/app/genealogy-tree/page.tsx
git commit -m "feat: add ancestor view (view N generations back)"
```
