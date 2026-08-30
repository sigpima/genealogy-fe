# Custom Tree Canvas + Viewport Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `react-d3-tree` with a custom `TreeCanvas` component (`d3-hierarchy` for layout, `d3-zoom` for pan/zoom) that only renders SVG elements for members inside the current viewport, so the on-screen element count is bounded by viewport size instead of tree size.

**Architecture:** Two pure modules (`src/lib/tree/layout.ts`, `src/lib/tree/viewport.ts`) port the exact layout/path formulas `react-d3-tree` itself uses internally (verified against its source) and add a viewport-rect + node/link filter. `TreeCanvas` is a domain-agnostic component: it owns the SVG, the `d3-zoom` behavior, and the two-tier memoization (full layout on data/collapse change, viewport filter on every pan/zoom tick), and takes a `renderNode` render-prop for node content — mirroring `react-d3-tree`'s `renderCustomNodeElement`, so the existing avatar/LOD/click-handler JSX in `page.tsx` moves over with minimal change. `page.tsx` owns `collapsedIds` (a plain `Set<number>`, replacing the library's internal collapse tracking) and drives centering via an imperative `centerOnNode(id)` on a ref to `TreeCanvas`.

**Tech Stack:** Next.js 15, React 19, TypeScript, `d3-hierarchy`/`d3-zoom`/`d3-selection`/`d3-shape` (already transitive deps of the existing `d3` package; `@types/d3-zoom` is added explicitly, matching how `@types/d3-hierarchy`/`@types/d3-selection`/`@types/d3-shape` are already declared), Vitest (existing setup).

**Spec:** `docs/superpowers/specs/2026-08-30-tree-canvas-design.md`

**Depends on:** `2026-08-30-tree-lod-design.md` and `2026-08-30-tree-lazy-detail-design.md`'s plans (already implemented) — this plan builds directly on `GenealogyTree`'s current state.

## Global Constraints

- Node visuals, spacing constants (`nodeSize={x:250,y:150}`, `separation={siblings:0.8,nonSiblings:1.5}`), and the step-link style must not change — this is a rendering-engine swap, not a redesign, per the spec's Goals.
- `TreeCanvas` must be imported via `next/dynamic(..., { ssr: false })` in `page.tsx`, exactly where `react-d3-tree`'s import is today — see the spec's Context for why (the accidental `/genealogy-tree` route's build-time prerender, and `d3-zoom`/`d3-select` needing `window`).
- No animation in this plan (expand/collapse transitions, zoom/pan momentum, animated centering) — that's a separate, later spec (3b).
- No container-resize handling — matches today's behavior (measured once on mount).
- `npx tsc --noEmit`, `npm run test`, and `npm run build` must all pass after every task.

---

## File Structure

```
genealogy-web/
  package.json                              # modified: +@types/d3-zoom, -react-d3-tree
  src/
    lib/tree/
      layout.ts                               # new: computeLayout, stepPath
      layout.test.ts                            # new
      viewport.ts                                 # new: visibleRect, filterVisibleNodes/Links
      viewport.test.ts                              # new
    components/tree/
      TreeCanvas.tsx                                 # new
    app/
      genealogy-tree/page.tsx                          # modified: TreeCanvas instead of react-d3-tree
      page.tsx                                           # modified: FocusRequest gains id, drops path-based lookup
```

---

### Task 1: `layout.ts` — `computeLayout` and `stepPath` (TDD)

**Files:**
- Create: `src/lib/tree/layout.ts`, `src/lib/tree/layout.test.ts`

**Interfaces:**
- Produces: `computeLayout(root: FamilyMember, collapsedIds: Set<number>, nodeSize: TreeNodeSize, separation: TreeSeparation): TreeLayout` and `stepPath(source: {x,y}, target: {x,y}): string`, both exported from `src/lib/tree/layout.ts`. `TreeLayout = { nodes: HierarchyPointNode<FamilyMember>[]; links: TreeLink[] }`, `TreeLink = { source: HierarchyPointNode<FamilyMember>; target: HierarchyPointNode<FamilyMember> }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tree/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeLayout, stepPath } from './layout';
import type { FamilyMember } from './types';

const nodeSize = { x: 100, y: 50 };
const separation = { siblings: 1, nonSiblings: 2 };

const tree: FamilyMember = {
  id: 1,
  name: 'root',
  children: [
    { id: 2, name: 'a', children: [{ id: 4, name: 'a1' }] },
    { id: 3, name: 'b' },
  ],
};

describe('computeLayout', () => {
  it('includes every node when nothing is collapsed, with depth-based y', () => {
    const { nodes } = computeLayout(tree, new Set(), nodeSize, separation);
    expect(nodes.map((n) => n.data.id).sort()).toEqual([1, 2, 3, 4]);
    const byId = new Map(nodes.map((n) => [n.data.id, n]));
    expect(byId.get(1)!.y).toBe(0);
    expect(byId.get(2)!.y).toBe(nodeSize.y);
    expect(byId.get(3)!.y).toBe(nodeSize.y);
    expect(byId.get(4)!.y).toBe(nodeSize.y * 2);
  });

  it('spreads siblings apart with the parent centered between them', () => {
    const { nodes } = computeLayout(tree, new Set(), nodeSize, separation);
    const byId = new Map(nodes.map((n) => [n.data.id, n]));
    const a = byId.get(2)!;
    const b = byId.get(3)!;
    const root = byId.get(1)!;
    expect(a.x).not.toBe(b.x);
    expect(root.x).toBeCloseTo((a.x + b.x) / 2, 5);
  });

  it('excludes a collapsed node\'s descendants from both nodes and links', () => {
    const { nodes, links } = computeLayout(tree, new Set([2]), nodeSize, separation);
    expect(nodes.map((n) => n.data.id).sort()).toEqual([1, 2, 3]);
    expect(links.some((l) => l.target.data.id === 4)).toBe(false);
  });

  it('produces one link per edge', () => {
    const { links } = computeLayout(tree, new Set(), nodeSize, separation);
    expect(links).toHaveLength(3);
  });
});

describe('stepPath', () => {
  it('matches the exact right-angle formula', () => {
    expect(stepPath({ x: 0, y: 0 }, { x: 100, y: 50 })).toBe('M0,0 V25 H100 V50');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- layout`
Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 3: Implement `layout.ts`**

Create `src/lib/tree/layout.ts`:

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- layout`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tree/layout.ts src/lib/tree/layout.test.ts
git commit -m "feat: add computeLayout and stepPath (ported from react-d3-tree)"
```

---

### Task 2: `viewport.ts` — visibility filtering (TDD)

**Files:**
- Create: `src/lib/tree/viewport.ts`, `src/lib/tree/viewport.test.ts`

**Interfaces:**
- Produces: `Transform = { x: number; y: number; k: number }`, `Rect = { x0: number; y0: number; x1: number; y1: number }`, `visibleRect(transform: Transform, width: number, height: number, marginMultiplier?: number): Rect` (default `marginMultiplier` is `1`), `filterVisibleNodes<T extends {x,y}>(nodes: T[], rect: Rect): T[]`, `filterVisibleLinks<T extends {source:{x,y}, target:{x,y}}>(links: T[], rect: Rect): T[]` — all from `src/lib/tree/viewport.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tree/viewport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterVisibleLinks, filterVisibleNodes, visibleRect } from './viewport';

describe('visibleRect', () => {
  it('computes the buffered rect at identity scale', () => {
    const rect = visibleRect({ x: 0, y: 0, k: 1 }, 800, 600, 1);
    expect(rect).toEqual({ x0: -800, y0: -600, x1: 1600, y1: 1200 });
  });

  it('divides by scale when inverting a zoomed-in transform', () => {
    const rect = visibleRect({ x: 0, y: 0, k: 2 }, 800, 600, 1);
    expect(rect.x0).toBe(-400);
    expect(rect.x1).toBe(800);
  });

  it('accounts for translation', () => {
    const rect = visibleRect({ x: 100, y: 0, k: 1 }, 800, 600, 1);
    expect(rect.x0).toBe(-900);
    expect(rect.x1).toBe(1500);
  });
});

describe('filterVisibleNodes', () => {
  const rect = { x0: 0, y0: 0, x1: 100, y1: 100 };

  it('includes nodes on the boundary', () => {
    expect(filterVisibleNodes([{ x: 0, y: 0 }, { x: 100, y: 100 }], rect)).toHaveLength(2);
  });

  it('excludes nodes just outside the boundary', () => {
    expect(filterVisibleNodes([{ x: -1, y: 0 }, { x: 0, y: 101 }], rect)).toHaveLength(0);
  });
});

describe('filterVisibleLinks', () => {
  const rect = { x0: 0, y0: 0, x1: 100, y1: 100 };

  it('includes a link when only one endpoint is inside the rect', () => {
    const links = [{ source: { x: 50, y: 50 }, target: { x: 500, y: 500 } }];
    expect(filterVisibleLinks(links, rect)).toHaveLength(1);
  });

  it('excludes a link with both endpoints outside the rect', () => {
    const links = [{ source: { x: 500, y: 500 }, target: { x: 600, y: 600 } }];
    expect(filterVisibleLinks(links, rect)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- viewport`
Expected: FAIL — `Cannot find module './viewport'`.

- [ ] **Step 3: Implement `viewport.ts`**

Create `src/lib/tree/viewport.ts`:

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- viewport`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tree/viewport.ts src/lib/tree/viewport.test.ts
git commit -m "feat: add visibleRect/filterVisibleNodes/filterVisibleLinks"
```

---

### Task 3: `TreeCanvas` component

**Files:**
- Create: `src/components/tree/TreeCanvas.tsx`
- Modify: `package.json` (add `@types/d3-zoom`)

**Interfaces:**
- Consumes: `computeLayout`, `stepPath` (Task 1); `visibleRect`, `filterVisibleNodes`, `filterVisibleLinks` (Task 2).
- Produces: default-exported `TreeCanvas` component and `TreeCanvasProps`/`TreeCanvasHandle` types, imported by Task 4 as
  `import TreeCanvas, { type TreeCanvasHandle } from '@/components/tree/TreeCanvas'` (via `next/dynamic`, see Task 4).

- [ ] **Step 1: Add `@types/d3-zoom`**

`d3-zoom`'s JS module is already resolvable (a transitive dependency of the
existing `d3` package), but its types aren't yet declared explicitly the
way `@types/d3-hierarchy`/`@types/d3-selection`/`@types/d3-shape` already
are. Note this project lists all `@types/*` packages under `dependencies`
in `package.json`, not `devDependencies` — follow that existing (if
unusual) convention rather than `devDependencies`. Change:

```json
    "@types/d3-shape": "^3.1.7",
```

to:

```json
    "@types/d3-shape": "^3.1.7",
    "@types/d3-zoom": "^3.0.8",
```

Run: `npm install`
Expected: no new packages downloaded (it's already in `node_modules` transitively) — this just records it as a direct devDependency and pins its resolved version in `package-lock.json`.

- [ ] **Step 2: Create `TreeCanvas.tsx`**

Create `src/components/tree/TreeCanvas.tsx`:

```tsx
'use client';

import type { HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { computeLayout, stepPath, type TreeNodeSize, type TreeSeparation } from '@/lib/tree/layout';
import { filterVisibleLinks, filterVisibleNodes, visibleRect } from '@/lib/tree/viewport';
import type { FamilyMember } from '@/lib/tree/types';

export type TreeCanvasProps = {
  familyTree: FamilyMember;
  collapsedIds: Set<number>;
  nodeSize: TreeNodeSize;
  separation: TreeSeparation;
  scaleExtent: { min: number; max: number };
  initialZoom: number;
  renderNode: (node: HierarchyPointNode<FamilyMember>) => React.ReactNode;
};

export type TreeCanvasHandle = {
  centerOnNode: (id: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};

const TreeCanvas = forwardRef<TreeCanvasHandle, TreeCanvasProps>(function TreeCanvas(
  { familyTree, collapsedIds, nodeSize, separation, scaleExtent, initialZoom, renderNode },
  ref
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: initialZoom });

  const handleContainerRef = (node: HTMLDivElement | null) => {
    if (node && !dimensions) {
      const rect = node.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

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

  const layout = useMemo(
    () => computeLayout(familyTree, collapsedIds, nodeSize, separation),
    [familyTree, collapsedIds, nodeSize, separation]
  );

  const { visibleNodes, visibleLinks } = useMemo(() => {
    if (!dimensions) return { visibleNodes: [], visibleLinks: [] };
    const rect = visibleRect(transform, dimensions.width, dimensions.height);
    return {
      visibleNodes: filterVisibleNodes(layout.nodes, rect),
      visibleLinks: filterVisibleLinks(layout.links, rect),
    };
  }, [layout, transform, dimensions]);

  useImperativeHandle(ref, () => ({
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
  }));

  return (
    <div ref={handleContainerRef} className="relative h-full w-full overflow-hidden bg-app">
      <svg ref={svgRef} className="h-full w-full">
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
      </svg>
    </div>
  );
});

export default TreeCanvas;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0. (`TreeCanvas.tsx` isn't imported anywhere yet, so this only confirms it compiles standalone.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/tree/TreeCanvas.tsx
git commit -m "feat: add TreeCanvas (d3-hierarchy + d3-zoom, viewport-virtualized)"
```

---

### Task 4: Wire `TreeCanvas` into the tree page, remove `react-d3-tree`

**Files:**
- Modify: `src/app/genealogy-tree/page.tsx`, `src/app/page.tsx`, `package.json`

**Interfaces:**
- Consumes: `TreeCanvas`, `TreeCanvasHandle` (Task 3).

- [ ] **Step 1: Update the search-result selection in `src/app/page.tsx`**

`FocusRequest`'s shape changes from carrying a `path` to carrying an `id`
(Step 2 below updates its declaration, in `src/app/genealogy-tree/page.tsx`,
as part of a larger block replace — this step only touches the *caller* in
`src/app/page.tsx`, a separate file untouched by Step 2).

In `src/app/page.tsx`, change:

```ts
          searchResults={matches.map((match) => ({
            key: match.path.join(' > '),
            label: match.path.join(' → '),
            onSelect: () => setFocusRequest({ path: match.path, token: Date.now() }),
          }))}
```

to:

```ts
          searchResults={matches.map((match) => ({
            key: match.path.join(' > '),
            label: match.path.join(' → '),
            onSelect: () => setFocusRequest({ id: match.member.id ?? -1, name: match.member.name, token: Date.now() }),
          }))}
```

- [ ] **Step 2: Replace imports and the `react-d3-tree`-derived types**

In `src/app/genealogy-tree/page.tsx`, change:

```ts
import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CustomNodeElementProps, TreeNodeDatum } from 'react-d3-tree';
import {
  MemberDetailPanel,
  type AvatarUploadResult,
  type MemberUpdateInput,
  type MutationResult,
  type PanelSpouse,
  type SpouseAddInput,
  type SpouseUpdateInput,
} from '@/components/tree/MemberDetailPanel';
import { TreeControls } from '@/components/tree/TreeControls';
import { idsNeedingDetail } from '@/lib/tree/detail-cache';
import { computeDetailSet } from '@/lib/tree/lod';
import { getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import type { FamilyMember, Gender, MemberDetail, Spouse } from '@/lib/tree/types';

const Tree = dynamic(() => import('react-d3-tree'), { ssr: false });

export type FocusRequest = {
  id: number;
  name: string;
  token: number;
};

type SelectedMember = {
  id: number;
  parentId: number | null;
  name: string;
  generation: number;
  ancestorPath: string[];
  childrenNames: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  avatarUrl: string | null;
  spouses: PanelSpouse[];
  isDetailLoading: boolean;
  detailLoadError: boolean;
};

// The API's tree nodes carry an id react-d3-tree's own RawNodeDatum/TreeNodeDatum types
// don't declare (they only know about `name`/`children`/`attributes`) - it survives at
// runtime since react-d3-tree doesn't strip unknown properties. Everything else about a
// member (birth/death/gender/notes/avatar/spouses) is fetched lazily - see detailsById.
type MemberNodeData = TreeNodeDatum & {
  id: number;
};

function toPanelSpouses(spouses: Spouse[] | undefined): PanelSpouse[] {
  return (spouses ?? []).map((spouse) => ({
    marriageId: spouse.marriage_id,
    spouseId: spouse.id,
    name: spouse.full_name,
    birthYear: spouse.birth_year,
    deathYear: spouse.death_year,
    gender: spouse.gender,
    notes: spouse.notes,
    marriageYear: spouse.marriage_year,
  }));
}

// Derived from CustomNodeElementProps rather than imported directly from 'd3-hierarchy' -
// react-d3-tree bundles its own (older) @types/d3-hierarchy, and the two HierarchyPointNode
// types are structurally incompatible for TS even though they're the same shape at runtime.
type HierarchyPointNodeOf = CustomNodeElementProps['hierarchyPointNode'];

type TreeInstanceHandle = {
  generateTree: () => { nodes: HierarchyPointNodeOf[] };
  centerNode: (node: HierarchyPointNodeOf) => void;
};

function pathOfHierarchyNode(node: HierarchyPointNodeOf): string[] {
  return node
    .ancestors()
    .reverse()
    .map((ancestor) => ancestor.data.name);
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.3, max: 2.5 };
const DETAIL_RADIUS = 3;
```

to:

```ts
import type { HierarchyPointNode } from 'd3-hierarchy';
import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MemberDetailPanel,
  type AvatarUploadResult,
  type MemberUpdateInput,
  type MutationResult,
  type PanelSpouse,
  type SpouseAddInput,
  type SpouseUpdateInput,
} from '@/components/tree/MemberDetailPanel';
import type { TreeCanvasHandle } from '@/components/tree/TreeCanvas';
import { TreeControls } from '@/components/tree/TreeControls';
import { idsNeedingDetail } from '@/lib/tree/detail-cache';
import { computeDetailSet } from '@/lib/tree/lod';
import { getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import type { FamilyMember, Gender, MemberDetail, Spouse } from '@/lib/tree/types';

const TreeCanvas = dynamic(() => import('@/components/tree/TreeCanvas'), { ssr: false });

export type FocusRequest = {
  id: number;
  name: string;
  token: number;
};

type SelectedMember = {
  id: number;
  parentId: number | null;
  name: string;
  generation: number;
  ancestorPath: string[];
  childrenNames: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  avatarUrl: string | null;
  spouses: PanelSpouse[];
  isDetailLoading: boolean;
  detailLoadError: boolean;
};

function toPanelSpouses(spouses: Spouse[] | undefined): PanelSpouse[] {
  return (spouses ?? []).map((spouse) => ({
    marriageId: spouse.marriage_id,
    spouseId: spouse.id,
    name: spouse.full_name,
    birthYear: spouse.birth_year,
    deathYear: spouse.death_year,
    gender: spouse.gender,
    notes: spouse.notes,
    marriageYear: spouse.marriage_year,
  }));
}

const NODE_SIZE = { x: 250, y: 150 };
const SEPARATION = { siblings: 0.8, nonSiblings: 1.5 };
const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.3, max: 2.5 };
const DETAIL_RADIUS = 3;
```

- [ ] **Step 3: Replace `translate`/`zoom`/`dimensions` state and `treeRef` with `collapsedIds` and `canvasRef`**

Change:

```ts
export default function GenealogyTree({ familyTree, focusRequest, onDataChanged }: GenealogyTreeProps) {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [initialTranslate, setInitialTranslate] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
```

to:

```ts
export default function GenealogyTree({ familyTree, focusRequest, onDataChanged }: GenealogyTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
```

Change:

```ts
  // react-d3-tree doesn't export a clean ref-typed public API; `generateTree`/`centerNode`
  // are real (non-private) instance methods used here the same way the library uses them
  // internally to center a clicked node. Verified against node_modules/react-d3-tree source.
  const treeRef = useRef<TreeInstanceHandle | null>(null);

  const handleContainerRef = (containerRef: HTMLDivElement | null) => {
    if (containerRef && !dimensions) {
      const rect = containerRef.getBoundingClientRect();
      const centered = { x: rect.width / 2, y: rect.height / 6 };
      setTranslate(centered);
      setInitialTranslate(centered);
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

  useEffect(() => {
    if (!focusRequest || !treeRef.current) return;
    const { nodes } = treeRef.current.generateTree();
    const target = nodes.find((node) => arraysEqual(pathOfHierarchyNode(node), focusRequest.path));
    if (!target) return;
    treeRef.current.centerNode(target);
    setHighlightedName(target.data.name);
    setFocalId((target.data as MemberNodeData).id);
    const timer = setTimeout(() => setHighlightedName(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRequest]);
```

to:

```ts
  const canvasRef = useRef<TreeCanvasHandle | null>(null);

  useEffect(() => {
    if (!focusRequest || !canvasRef.current) return;
    canvasRef.current.centerOnNode(focusRequest.id);
    setHighlightedName(focusRequest.name);
    setFocalId(focusRequest.id);
    const timer = setTimeout(() => setHighlightedName(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRequest]);
```

- [ ] **Step 4: Update `handleNodeClick` to work on `HierarchyPointNode<FamilyMember>` directly**

Change:

```ts
  function handleNodeClick(hierarchyPointNode: HierarchyPointNodeOf) {
    const ancestorPath = pathOfHierarchyNode(hierarchyPointNode);
    const data = hierarchyPointNode.data as MemberNodeData;
    const parentData = hierarchyPointNode.parent?.data as MemberNodeData | undefined;
    const childrenNames = data.children?.map((child) => child.name) ?? [];
    void openMemberDetail(data.id, parentData ? parentData.id : null, data.name, ancestorPath, childrenNames);
  }
```

to:

```ts
  function handleNodeClick(node: HierarchyPointNode<FamilyMember>) {
    const ancestorPath = node
      .ancestors()
      .reverse()
      .map((ancestor) => ancestor.data.name);
    const childrenNames = node.data.children?.map((child) => child.name) ?? [];
    void openMemberDetail(
      node.data.id ?? -1,
      node.parent?.data.id ?? null,
      node.data.name,
      ancestorPath,
      childrenNames
    );
  }
```

- [ ] **Step 5: Rewrite `renderNode` for the `TreeCanvas` render-prop signature**

Change:

```ts
  function renderNode({ nodeDatum, hierarchyPointNode, toggleNode }: CustomNodeElementProps) {
    const hasChildren = Boolean(nodeDatum.children && nodeDatum.children.length > 0);
    const isCollapsed = nodeDatum.__rd3t.collapsed;
    const isHighlighted = nodeDatum.name === highlightedName;
    const data = nodeDatum as MemberNodeData;
    const avatarClipId = `avatar-clip-${data.id}`;
    const isDetailed = detailSet.has(data.id);
    const avatarUrl = detailsById.get(data.id)?.avatar_url ?? null;

    return (
      <g>
        <rect
          width={200}
          height={70}
          x={-100}
          y={-35}
          rx={14}
          ry={14}
          className="fill-surface stroke-border"
          style={{
            strokeWidth: isHighlighted ? 3 : 1.5,
            stroke: isHighlighted ? 'var(--color-accent)' : undefined,
          }}
          onClick={() => handleNodeClick(hierarchyPointNode)}
        />
        {isDetailed &&
          (avatarUrl ? (
            <>
              <clipPath id={avatarClipId}>
                <circle cx={0} cy={-12} r={14} />
              </clipPath>
              <image
                href={avatarUrl}
                x={-14}
                y={-26}
                width={28}
                height={28}
                clipPath={`url(#${avatarClipId})`}
                preserveAspectRatio="xMidYMid slice"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(hierarchyPointNode)}
              />
            </>
          ) : (
            <>
              <circle
                cx={0}
                cy={-12}
                r={14}
                className="fill-primary"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(hierarchyPointNode)}
              />
              <text
                x={0}
                y={-12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-on-primary text-xs"
                style={{ pointerEvents: 'none' }}
              >
                {nodeDatum.name.charAt(0).toUpperCase()}
              </text>
            </>
          ))}
        <text
          x={0}
          y={18}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text text-sm"
          onClick={() => handleNodeClick(hierarchyPointNode)}
        >
          {nodeDatum.name}
        </text>
        {hasChildren && (
          <g
            transform="translate(85, -25)"
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
              setFocalId(data.id);
              toggleNode();
            }}
          >
            <circle r={10} className="fill-primary" />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-on-primary text-xs"
              style={{ pointerEvents: 'none' }}
            >
              {isCollapsed ? '+' : '−'}
            </text>
          </g>
        )}
      </g>
    );
  }
```

to:

```ts
  function renderNode(node: HierarchyPointNode<FamilyMember>) {
    const id = node.data.id ?? -1;
    const hasChildren = Boolean(node.data.children && node.data.children.length > 0);
    const isCollapsed = collapsedIds.has(id);
    const isHighlighted = node.data.name === highlightedName;
    const avatarClipId = `avatar-clip-${id}`;
    const isDetailed = detailSet.has(id);
    const avatarUrl = detailsById.get(id)?.avatar_url ?? null;

    return (
      <g>
        <rect
          width={200}
          height={70}
          x={-100}
          y={-35}
          rx={14}
          ry={14}
          className="fill-surface stroke-border"
          style={{
            strokeWidth: isHighlighted ? 3 : 1.5,
            stroke: isHighlighted ? 'var(--color-accent)' : undefined,
          }}
          onClick={() => handleNodeClick(node)}
        />
        {isDetailed &&
          (avatarUrl ? (
            <>
              <clipPath id={avatarClipId}>
                <circle cx={0} cy={-12} r={14} />
              </clipPath>
              <image
                href={avatarUrl}
                x={-14}
                y={-26}
                width={28}
                height={28}
                clipPath={`url(#${avatarClipId})`}
                preserveAspectRatio="xMidYMid slice"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node)}
              />
            </>
          ) : (
            <>
              <circle
                cx={0}
                cy={-12}
                r={14}
                className="fill-primary"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node)}
              />
              <text
                x={0}
                y={-12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-on-primary text-xs"
                style={{ pointerEvents: 'none' }}
              >
                {node.data.name.charAt(0).toUpperCase()}
              </text>
            </>
          ))}
        <text
          x={0}
          y={18}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text text-sm"
          onClick={() => handleNodeClick(node)}
        >
          {node.data.name}
        </text>
        {hasChildren && (
          <g
            transform="translate(85, -25)"
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
              setFocalId(id);
              setCollapsedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) {
                  next.delete(id);
                } else {
                  next.add(id);
                }
                return next;
              });
            }}
          >
            <circle r={10} className="fill-primary" />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-on-primary text-xs"
              style={{ pointerEvents: 'none' }}
            >
              {isCollapsed ? '+' : '−'}
            </text>
          </g>
        )}
      </g>
    );
  }
```

- [ ] **Step 6: Replace the `<Tree>` element and zoom-control wiring**

Change:

```tsx
  return (
    <div ref={handleContainerRef} className="relative h-full w-full overflow-hidden bg-app">
      <Tree
        // @ts-expect-error react-d3-tree's exported type doesn't model its class instance ref through next/dynamic
        ref={treeRef}
        data={familyTree}
        dimensions={dimensions ?? undefined}
        renderCustomNodeElement={renderNode}
        nodeSize={{ x: 250, y: 150 }}
        translate={translate}
        zoomable
        zoom={zoom}
        scaleExtent={SCALE_EXTENT}
        orientation="vertical"
        collapsible
        separation={{ siblings: 0.8, nonSiblings: 1.5 }}
        pathFunc="step"
        draggable
        onUpdate={({ zoom: liveZoom, translate: liveTranslate }) => {
          setZoom(liveZoom);
          setTranslate(liveTranslate);
        }}
      />
      <TreeControls
        onZoomIn={() => setZoom((z) => Math.min(SCALE_EXTENT.max, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(SCALE_EXTENT.min, z / 1.2))}
        onReset={() => {
          setZoom(INITIAL_ZOOM);
          setTranslate(initialTranslate);
        }}
      />
```

to:

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

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 8: Remove `react-d3-tree`**

Run: `npm uninstall react-d3-tree`
Expected: `package.json`/`package-lock.json` updated, package removed.

- [ ] **Step 9: Run the test suite**

Run: `npm run test`
Expected: PASS, all tests (Tasks 1–2's new ones plus everything from the prior two sub-projects) still green.

- [ ] **Step 10: Production build**

Run: `npm run build`
Expected: succeeds, including prerendering `/genealogy-tree` (the accidental route this plan's Global Constraints call out).

- [ ] **Step 11: Manual verification in the browser**

Requires `genealogy-api`'s dev server running and a logged-in session (same setup as the prior two sub-projects' manual verification).

Check:
- The tree's visual shape (node positions, step-angled connecting lines) looks the same as before this change, for both a shallow and a deeply-nested part of the seeded ~700-member tree.
- Zoom in/out/reset buttons work; scroll-to-zoom and drag-to-pan work.
- Clicking a node's `+`/`−` toggles its subtree's visibility; clicking a node's body opens the detail panel with the same loading→resolved behavior as before (from the lazy-detail sub-project).
- Searching a name and selecting a result re-centers on it and briefly highlights it, same as before — including a deeply-nested match whose ancestors happen to already be expanded (a match under a currently-collapsed ancestor silently not centering is a pre-existing limitation carried over from `react-d3-tree`'s equivalent behavior, not a new regression — not in scope to fix here).
- Using devtools' Elements panel, confirm the number of rendered `<g>`/`<path>` elements inside the tree's `<svg>` stays roughly constant (bounded by viewport) while panning to different parts of the tree, rather than scaling with total member count as it did before this change.
- No console errors.

- [ ] **Step 12: Commit**

```bash
git add src/app/genealogy-tree/page.tsx src/app/page.tsx package.json package-lock.json
git commit -m "feat: replace react-d3-tree with viewport-virtualized TreeCanvas"
```
