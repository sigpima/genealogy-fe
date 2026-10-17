# Heritage Tree Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the family-tree UI to the Heritage Tree design (three zoom levels, new shell, restyled panel) on existing API data, and make a ~2,000-member tree pan smoothly.

**Architecture:** Pure, tested helpers in `src/lib/tree/*` (generations, expansion, zoom/fit, status, detail queue, minimap math, synthetic fixture) feed a rewritten `TreeCanvas` (imperative pan transform, React state only when the visible set can change, level-aware `MemberCard`s, no per-node animation). `genealogy-tree/page.tsx` keeps all mutation handlers and wires in default-collapse, generation chips, auto-expand, bounded detail fetching. Theme system gains a `heritage` theme and new tokens.

**Tech Stack:** Next.js 15 / React 19 / Tailwind v4 / d3-zoom + d3-hierarchy / Vitest (pure logic only).

**Spec:** `docs/superpowers/specs/2026-10-17-heritage-redesign-design.md` (mockups: `/home/nuc/Documents/project/gia_pha/design/`, tokens: `design/heritage_tree/DESIGN.md`). Read both before starting. Read `CLAUDE.md` for the same-origin `/api` proxy, silent-refetch, and functional-`setSelectedMember` rules.

## Global Constraints

- No backend/API/schema changes; Vietnamese UI text; only data in `FamilyMember` (`id,name,children`) and `MemberDetail` is shown.
- Zoom levels: dot `k < 0.4`; compact `0.4 ≤ k ≤ 0.8`; detailed `k > 0.8`. Dot = 16px circle; compact card 160×56; detailed card 240×110.
- Layout slot is fixed at `NODE_SIZE = { x: 272, y: 206 }` with `SEPARATION = { siblings: 1, nonSiblings: 1.25 }` (siblings 272px apart = 240 + 32 gap; generations 206 apart = 110 + 96). Never relayout on a level change.
- Default expanded generations: 4. Visible-area margin: 0.5 × screen per side. Zoom floor 0.15 (dynamic, see Task 2), max 2.5. Detail-fetch concurrency 6.
- Living = birth year present, no death year, born ≤ 100 years ago. Older with no death year = unknown (`"1850 – ?"`, no "Đang sống").
- Palette (heritage): bg `#F9F6F0`, surface/card `#FFFFFF`, primary `#8B2635`, secondary `#C59B27`, tertiary `#1B4D3E`, text `#1C1C18`, muted `#564242`, border `#E3DCD1`, connector `#8C7D70`, tiers: ancestor (Đời 1–2) `#C59B27`, mid (3–5) `#8B2635`, descendant (6+) `#264653`; deceased `#4A4643`. Gold is for borders/dots/chips with dark text `#2B1D0C` only, never as text on white (contrast).
- Fonts: Noto Serif (names/headings) + Be Vietnam Pro (UI/metadata) via `next/font/google`, `vietnamese` subset. Icons are inline SVG. Use the semantic colour classes/CSS variables, never raw Tailwind colour utilities.
- No per-node/per-link JS animation (no framer-motion in the canvas); CSS motion must honour `prefers-reduced-motion`.
- Tests: Vitest, pure logic, `npx vitest run <file>`. Typecheck `npx tsc --noEmit`, lint `npm run lint`. Never run `npm run build` while `npm run dev` is running.
- Commit after each task; end every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Inputs the spec implies but its tasks' happy paths would not hit (each is pinned by a test or manual check in the owning task):

1. A tree with a single member (zero-size bounds): fit-to-view, min zoom and minimap must not produce NaN/Infinity (Tasks 2, 5, 10).
2. Names that are empty/whitespace/single-word, and members with only a birth year, only a death year, or neither (Tasks 1, 3).
3. Search/focus targeting a member inside a collapsed branch: branch opens, view centres on it (Tasks 1, 11).
4. Silent refetch after any edit keeps the user's zoom/pan/collapse state (no reset to the 4-generation default), and "add child" under a collapsed parent opens that parent (Task 11).
5. Detail fetch failing (API down, 401, synthetic ids): no retry storm, and cards stop showing a skeleton and fall back to unknown styling (Tasks 4, 9, 11).

---

### Task 1: Generation and expansion helpers

**Files:**
- Create: `src/lib/tree/generations.ts`, `src/lib/tree/generations.test.ts`, `src/lib/tree/expansion.ts`, `src/lib/tree/expansion.test.ts`

**Interfaces:**
- Produces (`generations.ts`):
  - `DEFAULT_EXPANDED_GENERATIONS = 4`
  - `type GenerationTier = 'ancestor' | 'mid' | 'descendant'`
  - `generationCounts(root: FamilyMember): number[]` (index 0 = Đời 1)
  - `totalMembers(root: FamilyMember): number`
  - `descendantCount(node: FamilyMember): number` (excludes the node)
  - `toRoman(n: number): string`
  - `generationTier(generation: number): GenerationTier`
  - `clanName(rootName: string): string`
- Produces (`expansion.ts`):
  - `collapsedIdsForDepth(root: FamilyMember, depth: number): Set<number>` — root is generation 1; every member at generation `depth` that has children is collapsed.
  - `expandedDepthOf(root: FamilyMember, collapsedIds: Set<number>): number | null` — smallest N in 1..deepest generation with `collapsedIds` equal to `collapsedIdsForDepth(root, N)`, else `null`.
  - `expandPathTo(root: FamilyMember, collapsedIds: Set<number>, targetId: number): Set<number>` — copy of `collapsedIds` minus the strict ancestors of the target (copy unchanged if target absent).

- [ ] **Step 1: Write failing tests** (fixture: 1 → {2,3}, 2 → {4}, 4 → {5}, 3 → {}; generations 1..4 have counts 1,2,1,1). Names and assertions:
  - `generationCounts` → `[1, 2, 1, 1]`; single member → `[1]`.
  - `totalMembers(fixture) === 5`; `descendantCount(fixture) === 4`; leaf → `0`.
  - `toRoman`: 1→`I`, 4→`IV`, 9→`IX`, 14→`XIV`, 40→`XL`.
  - `generationTier`: 1→ancestor, 2→ancestor, 3→mid, 5→mid, 6→descendant.
  - `clanName('Nguyễn Đức Khang') === 'Gia tộc Nguyễn'`; `clanName('  Trần ') === 'Gia tộc Trần'`; `clanName('') === 'Gia phả'`; `clanName('   ') === 'Gia phả'`.
  - `collapsedIdsForDepth(fixture, 2)` → `{2}` (2 has children, 3 does not); depth 1 → `{1}`; depth 9 → empty set.
  - `expandedDepthOf(fixture, collapsedIdsForDepth(fixture, 2)) === 2`; empty set → `4`; `new Set([5])` (uneven) → `null`.
  - `expandPathTo(fixture, new Set([1, 2, 4]), 5)` → `Set()`; target `3` with `{1,2}` → `{2}`; unknown id returns an equal copy (not the same instance).
- [ ] **Step 2:** `npx vitest run src/lib/tree/generations.test.ts src/lib/tree/expansion.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement both modules.** `clanName` uses the first whitespace-separated word. `expandedDepthOf` iterates N upward and compares set equality.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5:** `git add src/lib/tree && git commit -m "feat: add generation and expansion helpers"` (with the co-author line).

### Task 2: Zoom level, fit-to-view, recommit rule

**Files:**
- Create: `src/lib/tree/zoom.ts`, `src/lib/tree/zoom.test.ts`
- Modify: `src/lib/tree/viewport.ts`, `src/lib/tree/viewport.test.ts`

**Interfaces:**
- Consumes: `Transform`, `Rect`, `visibleRect` from `viewport.ts`.
- Produces (`zoom.ts`): `type ZoomLevel = 'dot' | 'compact' | 'detailed'`; `zoomLevelFor(k: number): ZoomLevel`; `type Bounds = { minX: number; minY: number; maxX: number; maxY: number }`; `boundsOf(points: { x: number; y: number }[]): Bounds | null`; `padBounds(b: Bounds, padX: number, padY: number): Bounds`; `fitTransform(bounds: Bounds, width: number, height: number, padding?: number): Transform` (default padding 48, `k` clamped to ≤ 1, zero-size bounds treated as size 1, result centres the bounds); `minZoomFor(fitK: number, floor?: number): number` (= `max(0.001, min(floor, fitK))`, default floor 0.15).
- Produces (`viewport.ts`): `VISIBLE_MARGIN = 0.5`; `type Committed = { rect: Rect; level: ZoomLevel }`; `needsRecommit(committed: Committed | null, transform: Transform, width: number, height: number): boolean` — true when `committed` is null, the level for `transform.k` differs, or the exact viewport (`visibleRect(transform, w, h, 0)`) is not fully inside `committed.rect`.

- [ ] **Step 1: Write failing tests.**
  - `zoomLevelFor(0.39) === 'dot'`, `0.4 → 'compact'`, `0.8 → 'compact'`, `0.81 → 'detailed'`.
  - `boundsOf([])` is `null`; `boundsOf([{x:1,y:2},{x:5,y:-3}])` → `{minX:1,minY:-3,maxX:5,maxY:2}`.
  - `fitTransform` with bounds 0..1000 × 0..500 into 800×600 padding 0: `k === 0.8`, and the bounds centre maps to the viewport centre. A single-point bounds (`minX===maxX`) returns finite `x,y,k` with `k ≤ 1`. Tiny bounds never exceed `k = 1`.
  - `minZoomFor(0.01) === 0.01`; `minZoomFor(0.5) === 0.15`; `minZoomFor(0) > 0`.
  - `needsRecommit(null, …) === true`; after committing at transform `{x:0,y:0,k:1}` (rect = `visibleRect(t,w,h,VISIBLE_MARGIN)`), a pan of a quarter screen → `false`, a pan of 0.6 screen → `true`; zooming from `k=0.5` to `k=0.9` → `true` (level change); zoom-out from 1.0 to 0.9 (same level, viewport grows beyond rect) → `true` when the new viewport escapes the rect.
- [ ] **Step 2:** `npx vitest run src/lib/tree/zoom.test.ts src/lib/tree/viewport.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Keep `visibleRect`'s default margin of 1 (existing tests rely on it).
- [ ] **Step 4:** same command → PASS (existing viewport tests still green).
- [ ] **Step 5:** commit `feat: add zoom level, fit transform and recommit rule`.

### Task 3: Member status and lifespan label

**Files:**
- Create: `src/lib/tree/member-status.ts`, `src/lib/tree/member-status.test.ts`

**Interfaces:**
- Produces: `type MemberStatus = 'living' | 'deceased' | 'unknown'`; `LIVING_MAX_AGE_YEARS = 100`; `memberStatus(birth: number | null, death: number | null, currentYear?: number): MemberStatus`; `lifespanLabel(birth: number | null, death: number | null, currentYear?: number): string | null`.

- [ ] **Step 1: Failing tests** (pass `currentYear = 2026`):
  - `memberStatus(1945, null, 2026) === 'living'`; `(1926, null) === 'living'`; `(1925, null) === 'unknown'`; `(1850, null) === 'unknown'`; `(null, null) === 'unknown'`; `(1918, 1989) === 'deceased'`; `(null, 1989) === 'deceased'`.
  - `lifespanLabel(1945, null, 2026) === '1945 – nay'`; `(1918, 1989) === '1918 – 1989'`; `(1850, null) === '1850 – ?'`; `(null, 1989) === '? – 1989'`; `(null, null) === null`.
- [ ] **Step 2:** `npx vitest run src/lib/tree/member-status.test.ts` → FAIL.
- [ ] **Step 3: Implement** per the Global Constraints rule.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** commit `feat: add member status and lifespan helpers`.

### Task 4: Bounded detail-fetch picker

**Files:**
- Create: `src/lib/tree/detail-queue.ts`, `src/lib/tree/detail-queue.test.ts`

**Interfaces:**
- Produces: `DETAIL_FETCH_CONCURRENCY = 6`; `pickIdsToFetch(candidates: { id: number; x: number; y: number }[], center: { x: number; y: number }, known: { has(id: number): boolean }, inflight: number, limit?: number): number[]` — ids not in `known`, nearest to `center` first, at most `limit - inflight` (never negative).

- [ ] **Step 1: Failing tests:** nearest-first ordering; ids in `known` (including previously failed ones) are skipped; `inflight = 6` → `[]`; `inflight = 4` → at most 2 ids; empty candidates → `[]`.
- [ ] **Step 2:** `npx vitest run src/lib/tree/detail-queue.test.ts` → FAIL.
- [ ] **Step 3:** Implement (sort a filtered copy by squared distance).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** commit `feat: add bounded detail-fetch picker`.

### Task 5: Minimap math and synthetic tree

**Files:**
- Create: `src/lib/tree/minimap.ts`, `src/lib/tree/minimap.test.ts`, `src/lib/tree/synthetic.ts`, `src/lib/tree/synthetic.test.ts`

**Interfaces:**
- Consumes: `Bounds`, `Rect`.
- Produces (`minimap.ts`): `type MinimapProjection = { scale: number; offsetX: number; offsetY: number }`; `minimapProjection(bounds: Bounds, width: number, height: number, padding?: number): MinimapProjection` (default padding 6; preserves aspect, centred; zero-size bounds → finite scale); `worldToMinimap(p: {x:number;y:number}, proj: MinimapProjection): {x:number;y:number}`; `minimapToWorld(p, proj)`; `viewRectOnMinimap(view: Rect, proj): { x: number; y: number; width: number; height: number }`.
- Produces (`synthetic.ts`): `generateSyntheticTree(count: number, seed?: number): FamilyMember` — deterministic (seeded LCG), ids `1..count` unique, name `` `Nguyễn Văn ${id}` ``, each member gets 0–4 children breadth-first until `count` is reached.

- [ ] **Step 1: Failing tests:** `minimapToWorld(worldToMinimap(p)) ≈ p`; projected bounds fit inside `width × height`; single-point bounds → finite `scale`/offsets; `viewRectOnMinimap` of a rect equal to the bounds spans the projected bounds. Synthetic: `totalMembers(generateSyntheticTree(2000)) === 2000`; two calls with the same seed are deep-equal; ids unique and root id is 1; `generationCounts(...).length >= 6`; `generateSyntheticTree(1)` has no children.
- [ ] **Step 2:** `npx vitest run src/lib/tree/minimap.test.ts src/lib/tree/synthetic.test.ts` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** commit `feat: add minimap projection and synthetic tree generator`.

### Task 6: Heritage theme, tokens, fonts

**Files:**
- Modify: `src/lib/theme/themes.ts`, `src/lib/theme/storage.test.ts`, `src/app/globals.css`, `src/app/layout.tsx`

**Interfaces:**
- Produces: `ThemeId` now `'heritage' | 'warm' | 'modern' | 'elegant'`; `DEFAULT_THEME = 'heritage'`; `isThemeId` accepts `'heritage'`; THEMES gains `{ id: 'heritage', label: 'Di sản', swatch: { bg: '#F9F6F0', primary: '#8B2635' } }` listed first. New CSS variables defined in **all four** themes: `--color-secondary`, `--color-on-secondary`, `--color-tertiary`, `--color-connector`, `--color-grid`, `--color-surface-muted`, `--color-tier-ancestor`, `--color-tier-mid`, `--color-tier-descendant`, `--color-living`, `--color-deceased`, `--shadow-card`, `--shadow-float`; new semantic classes for them (`bg-secondary`, `text-on-secondary`, `bg-surface-muted`, `fill-/stroke-connector`, `font-display`, `font-ui`, `shadow-card`, `shadow-float`, and the SVG fill/stroke variants the cards need). `:root` and `:root[data-theme='heritage']` carry the heritage values; `modern` gets its own block. `layout.tsx` exposes `--font-serif` (Noto Serif 600/700) and `--font-ui` (Be Vietnam Pro 400/500/600), replacing Inter; body uses the UI font.

- [ ] **Step 1: Failing tests** (extend `storage.test.ts`, jsdom): `getStoredTheme()` with nothing stored → `'heritage'`; with `'modern'` stored → `'modern'`; `isThemeId('heritage') === true`.
- [ ] **Step 2:** `npx vitest run src/lib/theme/storage.test.ts` → FAIL.
- [ ] **Step 3:** Implement themes + CSS (heritage values from Global Constraints; give warm/modern/elegant sensible values for new tokens, elegant must stay dark). Update the inline init script in `layout.tsx` to accept `'heritage'` (keep it in sync with `isThemeId`, as its comment says).
- [ ] **Step 4:** tests → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Manual: `npm run dev`; `/login` renders in heritage with the new fonts and no flash on reload; switching each of the four themes in the existing popover works. Commit `feat: add heritage theme, tokens and fonts`.

### Task 7: App shell (header, sidebar)

**Files:**
- Modify: `src/components/layout/Header.tsx`, `src/app/sidebar.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `clanName` (Task 1).
- Produces: `Header` gains prop `clanName: string` (rendered in serif on the left); its search keeps the same props and behaviour, restyled (focus: primary border + `rgba(197,155,39,0.2)` ring), results list restyled. `Sidebar` shows only "Cây Gia Phả" (active) with an inline-SVG icon; at `md` it collapses to an icon bar, below `md` it is hidden. `Home` passes `clanName(familyTree.name)` (fallback `'Gia phả'` while no tree).

- [ ] **Step 1:** Restyle per the mockups (`design/*/screen.png`): ivory surfaces, serif clan name, search with SVG magnifier + `aria-label`, logout and theme popover on the right, translucent header optional.
- [ ] **Step 2:** `npx tsc --noEmit` and `npm run lint` clean.
- [ ] **Step 3:** Manual at 1440px, 900px, 390px widths: sidebar full / icon bar / hidden; header does not overflow; search dropdown usable on mobile. Commit `feat: restyle app shell to heritage design`.

### Task 8: MemberCard (three levels)

**Files:**
- Create: `src/components/tree/MemberCard.tsx`

**Interfaces:**
- Consumes: `ZoomLevel`, `GenerationTier`, `MemberStatus`, `toRoman`, theme classes.
- Produces: `export const MemberCard = React.memo(function MemberCard(props: MemberCardProps))` where
  ```ts
  type MemberCardProps = {
    id: number; name: string; generation: number; level: ZoomLevel;
    status: MemberStatus; lifespan: string | null;
    detailState: 'loading' | 'loaded' | 'failed';
    avatarUrl: string | null; spouseLabel: string | null; childCount: number;
    hasChildren: boolean; isCollapsed: boolean; hiddenDescendants: number;
    isHighlighted: boolean; isSelected: boolean;
    onSelect: (id: number) => void; onToggle: (id: number) => void;
  };
  ```
  Renders an SVG `<g>` centred on (0,0).

- [ ] **Step 1: Implement the three levels.** Dot: one `<circle r=8>` in the tier colour plus `<title>{name} · Đời {generation}</title>`. Compact (160×56, rx 8): serif name (13px, truncated with an ellipsis to fit), "Đời {roman}" badge, lifespan line only when `detailState === 'loaded'` and non-null (reserve the line otherwise). Detailed (240×110, rx 8): portrait circle r=24 (image via clipPath only when `avatarUrl`, else initial on `fill-primary`) with status border (`living` → tertiary, `deceased` → deceased grey, `unknown` → border colour), name, badge, lifespan, `Phối: {spouseLabel}` when present, `{childCount} con` when > 0; while `detailState === 'loading'` the lifespan/spouse lines render as muted skeleton bars; `'failed'` renders as unknown (no skeleton, no wrong values). Tier-`ancestor` cards get a gold border and deeper-ivory fill. Highlight/selected: primary stroke 2.5px. Expand/collapse toggle (circle with ±) at the card's bottom edge for compact/detailed when `hasChildren`; when `isCollapsed` also a tag "`{hiddenDescendants}` hậu duệ" below the card. At dot level clicking selects only.
- [ ] **Step 2:** Every card: `role="button"`, `tabIndex={0}`, `aria-label` = name + generation, Enter/Space → `onSelect(id)`; toggle is stopPropagation and has its own `aria-label` ("Mở nhánh" / "Thu nhánh").
- [ ] **Step 3:** `npx tsc --noEmit` and `npm run lint` clean. (Visual check happens in Task 10/11.) Commit `feat: add three-level MemberCard`.

### Task 9: TreeCanvas rewrite (performance core)

**Files:**
- Modify: `src/components/tree/TreeCanvas.tsx`, `package.json` (remove `framer-motion` and `motion` if `grep -r "framer-motion\|from 'motion" src` shows no other use)
- Create: `src/components/tree/Minimap.tsx`

**Interfaces:**
- Consumes: `computeLayout`, `stepPath`, `filterVisible*`, `visibleRect`, `VISIBLE_MARGIN`, `needsRecommit`, `Committed`, `zoomLevelFor`, `boundsOf`, `padBounds`, `fitTransform`, `minZoomFor`, `minimap*` helpers, momentum helpers.
- Produces:
  ```ts
  export type ViewState = { x: number; y: number; k: number; minZoom: number; maxZoom: number };
  export type VisibleChange = { nodes: { id: number; x: number; y: number }[]; level: ZoomLevel; center: { x: number; y: number } };
  export type TreeCanvasProps = {
    familyTree: FamilyMember; collapsedIds: Set<number>;
    nodeSize: TreeNodeSize; separation: TreeSeparation;
    scaleExtent: { min: number; max: number };   // min = floor (0.15); actual min is dynamic
    initialZoom: number;
    renderNode: (node: HierarchyPointNode<FamilyMember>, level: ZoomLevel) => React.ReactNode;
    onVisibleChange?: (change: VisibleChange) => void;  // fired only on commits
  };
  export type TreeCanvasHandle = {
    centerOnNode(id: number): void; zoomIn(): void; zoomOut(): void; resetView(): void;
    fitToView(): void; setZoom(k: number): void;
    subscribe(listener: (view: ViewState) => void): () => void;
  };
  ```

- [ ] **Step 1: Pan without re-render.** Keep the d3-zoom setup and momentum. On every zoom event write `transform` to the content `<g>` via a ref and update `transformRef`; call subscribers; call `setCommitted` (React state: `{rect, level}`) **only** when `needsRecommit(committed, t, w, h)` is true, computing the rect with `VISIBLE_MARGIN`. All handle methods (`centerOnNode`, zoom, reset, fit) read `transformRef.current`, not state.
- [ ] **Step 2: Render.** Nodes: `filterVisibleNodes` on the layout with the committed rect, each as a plain `<g transform>` keyed by id wrapping `renderNode(node, level)`; no framer-motion, no fades. Links: **one** `<path>` whose `d` joins `stepPath` of every visible link, `fill-none`, stroke `connector`, `strokeWidth={1.5}` with `vectorEffect="non-scaling-stroke"`; plus a small filled circle at the branch junction (`source.x`, midpoint y) for visible parents with more than one child. Container background: dot grid from `--color-grid` (24px).
- [ ] **Step 3: Dynamic zoom floor and fit.** When the layout changes, compute `bounds = padBounds(boundsOf(nodes), nodeSize.x / 2, nodeSize.y / 2)`, `fitK = fitTransform(bounds, w, h).k`, call `zoomBehavior.scaleExtent([minZoomFor(fitK, scaleExtent.min), scaleExtent.max])`; `fitToView()` transitions to `fitTransform(bounds, w, h)`; `setZoom(k)` zooms about the viewport centre; `subscribe` listeners receive the `ViewState` including `minZoom`/`maxZoom`. A single-member tree must produce finite values everywhere.
- [ ] **Step 4: Fire `onVisibleChange`** after each commit (and when layout changes) with visible nodes `{id,x,y}`, current level and the world-space viewport centre.
- [ ] **Step 5: `Minimap.tsx`** (rendered by the canvas, hidden below `md`): one `<canvas>` (about 200×120) drawing all layout nodes as 1–2px dots once per layout, a primary-coloured rectangle for the current view (updated via `subscribe`, no React re-render per frame), pointer drag → `minimapToWorld` → pan so that point is centred. Uses the translucent ivory floating style.
- [ ] **Step 6:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` all clean. Remove the unused dependencies with `npm uninstall` if applicable.
- [ ] **Step 7: Manual** (needs Task 10's integration to see real cards; until then verify with the existing `renderNode`): pan/zoom/momentum feel unchanged, links draw, no console errors. Commit `feat: rewrite TreeCanvas with imperative pan and level-aware rendering`.

### Task 10: Tree page integration

**Files:**
- Modify: `src/app/genealogy-tree/page.tsx`, `src/app/page.tsx`
- Create: `src/components/tree/GenerationFilterBar.tsx`, `src/components/tree/ViewportControls.tsx`, `src/components/tree/StatusStrip.tsx`; delete `src/components/tree/TreeControls.tsx` when unused.

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces:
  - `GenerationFilterBar({ counts: number[]; activeDepth: number | null; onSelectDepth: (depth: number) => void })` — chips "Đời {roman} ({count})" (chip 1 reads "Đời I (Khởi Tổ)"); shows the first 6 and a "+k đời" chip that toggles showing all; active chip = `activeDepth`.
  - `ViewportControls({ canvasRef: React.RefObject<TreeCanvasHandle | null> })` — bottom-centre translucent bar: −, range slider (min/max from `ViewState`, label `{round(k*100)}%`), +, Reset, "Toàn cảnh"; subscribes to the handle itself.
  - `StatusStrip({ total: number; generations: number; zoomPercent: number })`.
  - `GenealogyTree` gains optional prop `synthetic?: boolean` (disables detail fetching). `Home` enables it only when `process.env.NODE_ENV !== 'production'` and the URL has `?synthetic=<n>` (uses `generateSyntheticTree(n)` instead of the API).

- [ ] **Step 1: Default collapse.** Initialise `collapsedIds` once with `collapsedIdsForDepth(familyTree, DEFAULT_EXPANDED_GENERATIONS)`. A silent refetch (`onDataChanged`) must **not** reset it (keep state, as today). Layout constants per Global Constraints (`NODE_SIZE`, `SEPARATION`, `scaleExtent {min: 0.15, max: 2.5}`).
- [ ] **Step 2: Chips.** `onSelectDepth(n)` → `setCollapsedIds(collapsedIdsForDepth(familyTree, n))`; `activeDepth = expandedDepthOf(familyTree, collapsedIds)`; counts from `generationCounts(familyTree)`.
- [ ] **Step 3: Auto-expand.** In the `focusRequest` effect and in `handleViewAncestors`, first `setCollapsedIds(prev => expandPathTo(displayRoot-or-familyTree, prev, id))`, then centre in `requestAnimationFrame` as today. After a successful add-child (`handleAddChildMember`), remove the parent's id from `collapsedIds` so the new child is visible.
- [ ] **Step 4: Selection by id.** Replace `handleNodeClick(node)` with `handleSelectMember(id: number)` using `findAncestorChainById(familyTree, id)` (full chain from the real root, so ancestor-view selections still resolve in `getMemberAtPath`): `ancestorPath = chain.map(name)`, `parentId = chain[chain.length-2]?.id ?? null`, `childrenNames` from the last element. `renderNode(node, level)` now returns a `MemberCard` with props derived from `detailsById`, `memberStatus`, `lifespanLabel`, `generation = node.depth + 1 + offset` where offset is the generation of the display root in the full tree (so ancestor view keeps true generation numbers), first spouse name (+ " +n"), `childCount = node.data.children?.length`, `hiddenDescendants = descendantCount(node.data)` when collapsed. `onSelect`/`onToggle` must be stable (`useCallback`) so `MemberCard` memoisation holds; the toggle keeps `setFocalId(id)` as today.
- [ ] **Step 5: Detail state per card.** `detailState`: `'loaded'` if in `detailsById`; `'failed'` if the fetch promise resolved `null` (track failed ids in a `useRef<Set<number>>` updated in `ensureMemberDetail`'s `.then`, and bump a counter state to re-render); otherwise `'loading'`.
- [ ] **Step 6: Bounded visible prefetch.** Handle `onVisibleChange`: when `level !== 'dot'` and not `synthetic`, loop `pickIdsToFetch(change.nodes, change.center, detailFetches.current, inflightRef.current)`, call `ensureMemberDetail` for each (increment `inflightRef`, decrement and re-run the loop in `.finally`). Keep the existing focal-radius prefetch effect. Failed fetches stay in `detailFetches` so they are never retried automatically (retry only through the panel's existing retry button).
- [ ] **Step 7: Chrome.** Render `GenerationFilterBar` (top, floating translucent), `ViewportControls` (bottom-centre), `StatusStrip` (bottom, zoom % via `canvasRef.subscribe`), and keep the "Xem toàn bộ cây gia phả" button restyled. Remove `TreeControls`.
- [ ] **Step 8:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` clean.
- [ ] **Step 9: Manual checklist** (real API + `?synthetic=2000` in dev): opens at 4 generations; chips expand/collapse and the active chip is correct; search for a member in a collapsed branch opens the branch and centres; collapse/expand a branch; zoom through 0.3 / 0.6 / 1.2 and see dot / compact / detailed; Toàn cảnh fits; stopping the API makes cards stop skeleton-ing and no request storm appears in the Network tab; editing a member keeps the zoom/pan/collapse state; adding a child under a collapsed parent opens it; panel open/rename/delete still work. Commit `feat: wire heritage tree page (default collapse, chips, auto-expand, bounded prefetch)`.

### Task 11: Member panel restyle

**Files:**
- Modify: `src/components/tree/MemberDetailPanel.tsx`

**Interfaces:**
- Consumes: `memberStatus`, `lifespanLabel`, `toRoman`, `generationTier`. Props and every handler contract of `MemberDetailPanel` stay **unchanged**.

- [ ] **Step 1: Presentation only.** Container: right drawer `w-[400px]` at `xl`; overlay with a dimmed backdrop at `md`–`xl`; bottom sheet (`max-h-[90vh]`, rounded top, drag-free) below `md`. Header: "Đời {roman}" badge in the tier colour, serif name, portrait (existing `AvatarOrInitial`) with an "Đang sống" badge only when `memberStatus === 'living'`, `lifespanLabel`. Two tabs with `role="tablist"`: "Tiểu sử" (notes under "Hành trạng & công đức", the edit form, avatar controls, ancestor-view and delete actions) and "Hôn phối & con" (spouses list/edit/add, children list, add child). Warm shadow, ivory sections, serif headings, Be Vietnam Pro body, visible focus rings, ≥44px touch targets for buttons on mobile.
- [ ] **Step 2:** Replace the local `lifespanOf` with `lifespanLabel`.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm run lint` clean.
- [ ] **Step 4: Manual:** every flow in the panel still works end to end against the API (edit all fields, upload/remove avatar, add/edit/delete spouse, add child, reparent closes the panel, delete, retry after detail failure, view ancestors); Esc/close button works; layout correct at 1440 / 900 / 390px. Commit `feat: restyle member detail panel`.

### Task 12: Performance pass and docs

**Files:**
- Modify: whichever of the Task 9/10 files the measurements point at; `CLAUDE.md`

- [ ] **Step 1: Measure** with `npm run dev`, `?synthetic=2000`, Chrome DevTools → Performance: record ~5s of continuous drag plus a wheel-zoom at zoom ≈ 0.2, 0.6 and 1.2 (expand all with the last chip first). Pass = no sustained frames over ~33ms. Record the numbers in the commit message.
- [ ] **Step 2:** If it fails, tune in this order and re-measure: visible margin (`VISIBLE_MARGIN`), card element count at compact/detailed, `React.memo` effectiveness (confirm cards don't re-render during pan with the React profiler), commit frequency of `onVisibleChange`.
- [ ] **Step 3: Update `CLAUDE.md`:** replace the stale `react-d3-tree` paragraphs with the real architecture (TreeCanvas, imperative pan/recommit, zoom levels, default collapse, bounded prefetch), the new theme (heritage default, new tokens, fonts), and the `?synthetic=N` dev switch.
- [ ] **Step 4:** `npx vitest run`, `npx tsc --noEmit`, `npm run lint` all clean. Commit `perf: tune tree rendering; docs: update CLAUDE.md for heritage redesign`.
