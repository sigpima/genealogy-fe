# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install dependencies: `npm install`
- Run the dev server: `npm run dev` (Turbopack)
- Run all unit tests: `npm run test` (or `npx vitest run`)
- Run a single test file: `npx vitest run src/lib/tree/search.test.ts`
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Production build: `npm run build`

**Never run `npm run build` while `npm run dev` is running against the same
`.next` directory** — both write to it concurrently on this machine and
corrupt the build manifest, producing a spurious "Internal Server Error" /
`ENOENT ... _buildManifest.js.tmp...` on the dev server. Stop the dev
server (kill the port 3000 listener) before building, then restart dev
afterward if needed.

## Architecture

Next.js 15 App Router / React 19 / Tailwind v4 app: an interactive family
tree (`react-d3-tree`) plus login/signup pages that are **visual only** —
no backend call exists yet (see `docs/superpowers/specs/` for the
non-goals of the current design; backend wiring is a separate future
piece of work against the sibling `genealogy-api` project).

**Theming is a runtime-switchable, CSS-variable system, not Tailwind's
`@theme` token registration.** `src/app/globals.css` defines one
`:root[data-theme="warm|modern|elegant"]` block per theme (colors only:
`--color-bg`, `--color-surface`, `--color-primary`, `--color-accent`,
`--color-text`, `--color-text-muted`, `--color-border`, `--color-on-primary`),
plus a `@layer components` block mapping them to semantic utility classes
(`bg-app`, `bg-surface`, `bg-primary`, `text-default`, `text-muted`,
`text-on-primary`, `accent-text`, `border-default`, and SVG-specific
`fill-surface`/`fill-border`/`fill-primary`/`fill-on-primary`/`fill-text`/
`stroke-border`/`stroke-accent`). **Every new component should use these
semantic classes, never a raw Tailwind color utility** — that was the
whole point of introducing them (the pre-redesign codebase hardcoded
`purple-600`/`gray-*` everywhere, which is what made a color-only reskin
impossible without touching every component).

The theme choice is persisted in `localStorage["genealogy-web:theme"]`
(`src/lib/theme/storage.ts`) and applied via a `data-theme` attribute on
`<html>`. `src/app/layout.tsx` sets that attribute **twice**: once
synchronously via an inline `<script>` before hydration (to avoid a flash
of the wrong theme), and once reactively from `ThemeProvider`
(`src/components/theme/ThemeProvider.tsx`) after mount. `<html>` has
`suppressHydrationWarning` — the inline script's DOM mutation genuinely
doesn't match the server-rendered HTML, and that particular mismatch is
expected and safe to suppress (React's hydration warning about it is
otherwise a false positive, not a real bug).

**The tree page (`src/app/genealogy-tree/page.tsx`) leans on
`react-d3-tree` internals beyond its documented prop API**, specifically
so name search can recenter the view on an arbitrary (possibly deeply
nested) match:
- `Tree`'s `zoom`/`translate` props are kept in sync with the library's
  live pan/zoom state via its `onUpdate` callback — this was necessary
  because setting `zoom` alone (e.g. from the +/- buttons) without also
  tracking the current `translate` would snap the view back to a stale
  position (`bindZoomListener` resets both together whenever either prop
  changes; read `node_modules/react-d3-tree/lib/esm/Tree/index.js`'s
  `componentDidUpdate`/`bindZoomListener` before changing this).
- Search-driven centering calls `generateTree()` and `centerNode()`
  directly on the `Tree` class instance via a ref (`@ts-expect-error` on
  the ref prop — react-d3-tree's exported types don't model passing a ref
  through `next/dynamic`). These are real, non-private instance methods
  (verified by reading the library source), not officially part of its
  public API, so a `react-d3-tree` version bump should be re-verified
  against source if centering breaks.
- A `HierarchyPointNode` type is derived as
  `CustomNodeElementProps['hierarchyPointNode']` rather than imported
  directly from `d3-hierarchy` — react-d3-tree bundles its own nested
  `@types/d3-hierarchy`, and the two versions are structurally
  incompatible for TypeScript even though identical at runtime.

**Search/lookup logic is pure and tested independently of the tree UI**:
`src/lib/tree/search.ts` (`findMembersByName`, `findPathToMember`,
`generationOf`, `getMemberAtPath`) operates on the plain
`{name, children?}` shape (`FamilyMember`, `src/lib/tree/types.ts`) — the
same shape as `new_treeData.json` — with no react-d3-tree dependency.

**Tree data (`src/app/genealogy-tree/new_treeData.json`) has only `name`
and `children`** — no birth/death dates, gender, or notes. The member
detail panel (`src/components/tree/MemberDetailPanel.tsx`) only shows
what that data actually has (name, generation, ancestor breadcrumb,
children); don't invent fields the data doesn't contain.

## Testing

Vitest covers pure logic only (`src/lib/**/*.test.ts`) —
`src/lib/tree/search.test.ts` runs in the default `node` environment;
`src/lib/theme/storage.test.ts` needs `// @vitest-environment jsdom` (a
per-file pragma) since it touches `window.localStorage`. There is no
component/E2E test setup (no React Testing Library, no Playwright
config) — UI and interaction behavior (theme switching, zoom/pan,
expand/collapse, search-and-center, the detail panel) is verified by
running `npm run dev` and checking it in a browser, not automated.
