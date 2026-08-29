# Frontend Redesign — Design Spec

Date: 2026-08-29
Status: Approved for implementation planning

## Context

`genealogy-web` is a Next.js 15 / React 19 / Tailwind v4 app, currently an
unmodified `create-next-app` scaffold with a tree-visualization demo bolted
on. Baseline snapshot committed at `9eee7ec`. Specific problems found:

- `tsc --noEmit` fails: `src/app/genealogy-tree/components/card.tsx`,
  `src/lib/validators.tsx`, `src/lib/parser.tsx`, and
  `src/app/genealogy-tree/components/Link/index.tsx` import a non-existent
  `@/types/common` module. None of these four files are imported by
  anything that renders (dead code).
- `src/app/route.tsx` is an empty, invalid route handler (must be
  `route.ts` with exported HTTP methods to do anything — currently inert).
- `src/app/genealogy-tree/treeData.json` (7059 lines) is unused — only
  `new_treeData.json` is imported, by `src/app/genealogy-tree/page.tsx:5`.
- `src/app/page.module.css` (167 lines) is unused — no file imports it.
- `src/app/{error,loading,not-found,global-error,template,default}.tsx`
  are all 0-byte stubs.
- `src/app/sidebar.tsx` is unmodified Preline UI boilerplate ("Brand",
  "Dashboard", "Calendar", "Documentation" — `href="#"` links, Preline's
  JS isn't installed so the toggle markup is inert).
- `src/app/page.tsx` imports `LoginPage` but never renders it.
- The tree (`src/app/genealogy-tree/page.tsx`) already uses `react-d3-tree`
  with `zoomable`, `collapsible`, and `draggable` all enabled, but the node
  renderer is a bare rectangle+name with no styling system, and there is no
  UI for search, zoom controls, or viewing a member's detail.
- Login/signup (`src/app/login/`, `src/app/signup/`, shared components in
  `src/components/{Header,Input,FormAction,FormExtra}.tsx`,
  `src/constants/formFields.tsx`) are structurally reusable — real
  controlled inputs, real field config — but styled with hardcoded
  `purple-600`/`gray-*` Tailwind classes and a placeholder external logo
  URL, and `handleSubmit` only calls `e.preventDefault()` (no backend
  call — intentionally out of scope here, see Non-goals).
- Tree data (`new_treeData.json`) has **only** `name` and `children` per
  node — no birth/death dates, gender, or notes. Any "detail view" this
  round is bounded by what that data actually contains.

## Goals

- Fix the TypeScript build (delete the dead files causing it, don't
  resurrect `@/types/common`).
- A configurable color theme system: 3 selectable palettes, switchable at
  runtime from a settings popover, persisted per-browser, with no flash of
  the wrong theme on load.
- Redesign the shell: sidebar (kept, redesigned) + header (new, with
  search + theme settings entry point).
- Tree interactivity: zoom in/out/reset controls, expand/collapse
  (already partially supported by the library, needs a styled affordance),
  name search with a result list that expands the path to and centers the
  matched node.
- A member detail panel (slide-in from the right) showing name, generation
  number, ancestor breadcrumb, and children — the fields the data actually
  has.
- Restyle login/signup pages to the new design system (visual only).

## Non-goals

- Wiring login/signup to `genealogy-api` (a separate, later spec).
- Adding birth/death/gender/notes fields to the tree data or UI — the data
  doesn't have them yet.
- Fuzzy or diacritic-insensitive search — exact substring match on the
  Vietnamese text as stored is enough for this round.
- End-to-end/browser test automation (no Playwright/Cypress setup) — UI
  behavior is verified by running the dev server and checking it in a
  browser during implementation, per this project's normal workflow.
- Changing the underlying tree library (staying on `react-d3-tree`, per
  the earlier decision that "interactive like react-d3-tree" means using
  it properly, not replacing it).

## Architecture

### Theming

Plain CSS custom properties, not Tailwind v4's `@theme` token mapping —
this sidesteps version-specific `@theme` gotchas and is simpler to reason
about for a 3-theme swap. `src/app/globals.css` defines one `:root[data-theme="X"]`
block per theme (`warm`, `modern`, `elegant`), each setting
`--color-bg`, `--color-surface`, `--color-primary`, `--color-accent`,
`--color-text`, `--color-text-muted`, `--color-border`. A `@layer components`
block maps these to semantic utility classes (`bg-app`, `bg-surface`,
`text-default`, `text-muted`, `border-default`, `bg-primary`, ...) that
components use instead of raw Tailwind color utilities. `modern` is also
the bare `:root` default (pre-JS/no-attribute fallback).

State: `src/lib/theme/themes.ts` exports the 3 theme ids + display labels +
swatch preview colors (kept in sync with the CSS by hand — 3 entries is
small enough that a codegen step would be over-engineering).
`src/lib/theme/storage.ts` reads/writes `localStorage["genealogy-web:theme"]`.
A small inline script in `src/app/layout.tsx`'s `<head>` reads that key and
sets `data-theme` on `<html>` synchronously, before React hydrates, to
avoid a flash of the wrong theme. A `ThemeProvider` client component
wraps the app, exposes `useTheme()` (current id + setter), and keeps the
DOM attribute and localStorage in sync when the user picks a new theme.

All 3 themes must meet WCAG AA contrast (4.5:1) for `--color-text` on
`--color-bg` and `--color-surface`, and for white/near-white text on
`--color-primary` where used on buttons.

### Layout shell

Sidebar (`src/app/sidebar.tsx`, rewritten): real branding, one active nav
item ("Cây gia phả"), no dead `href="#"` links, no unused Preline
minifier markup. Header (new `src/components/layout/Header.tsx` — this
replaces the *login-page* `Header` component's name collision; the login
page header gets renamed, see File Structure): search input (left/center)
+ theme settings gear button (right), rendered above the tree canvas.

### Tree interactivity

`src/app/genealogy-tree/page.tsx` keeps `react-d3-tree` but gets a real
custom node renderer using the theme's semantic classes (rounded rect,
`bg-surface`/`border-default`, hover state, a visible +/- affordance on
nodes that have children reflecting collapsed/expanded state).

- **Zoom controls:** on-screen +/-/reset buttons drive the existing
  `zoom`/`translate` state (the component already manages `translate` in
  state for initial centering — this extends the same pattern instead of
  introducing a new mechanism).
- **Expand/collapse:** the library's `collapsible` behavior stays; the new
  node renderer makes the collapsed/expanded affordance visible (the
  current renderer gives no visual indication at all).
- **Search:** `src/lib/tree/search.ts` walks the tree data (pure
  function, unit-testable) to find members whose name includes the query
  (case-insensitive substring) and returns each match's ancestor path.
  Selecting a result from the header search expands every ancestor along
  that path (if `react-d3-tree`'s collapse state hides it) and recenters
  the view on the matched node, with a brief highlight.

### Detail panel

Clicking a node's body (distinct from clicking its expand/collapse
affordance) opens `src/components/tree/MemberDetailPanel.tsx`, a
right-side slide-in showing: name, generation number (1-indexed depth
from the root), the ancestor breadcrumb (from `lib/tree/search.ts`'s path
logic, reused for "path to an arbitrary clicked node" not just search
matches), and a clickable list of direct children (clicking one re-targets
the panel to that child). No birth/death/gender fields — not in the data.

### Cleanup

Delete: `card.tsx`, `parser.tsx`, `validators.tsx`, `Link/index.tsx`,
`route.tsx`, `treeData.json` (old, unused), `page.module.css` (unused).
Give real content to `loading.tsx` (simple centered spinner), `not-found.tsx`
(styled 404 with a link home), `error.tsx` (error message + retry button).
Delete `global-error.tsx`, `template.tsx`, `default.tsx` — Next.js doesn't
require any of them and they're currently empty no-ops (YAGNI: add back if
a real need for them shows up). Remove the unused `LoginPage` import from
`src/app/page.tsx`. Rename `package.json`'s `name` from `"my-project"` to
`"genealogy-web"`. Rewrite `README.md` to describe the actual app instead
of the `create-next-app` boilerplate text.

### Login/signup restyle

Keep the existing component structure and form logic (`loginForm.tsx`,
`signupForm.tsx`, `Input.tsx`, `FormAction.tsx`, `FormExtra.tsx`,
`formFields.tsx`) — it's functionally fine for this round's scope (no
backend call). Restyle to the semantic theme classes instead of hardcoded
`purple-600`/`gray-*`, replace the external placeholder logo URL with
something belonging to this app (or remove the logo slot if nothing
suitable exists yet), and remove the stray `console.log(signupState)` left
in `signupForm.tsx`.

## Testing

No existing frontend test infra (no Jest/Vitest/Playwright). This spec
adds **Vitest** for pure-logic unit tests only:
`src/lib/tree/search.ts` (name matching, ancestor path correctness,
generation numbering) and `src/lib/theme/storage.ts` (read/write/invalid
value handling). Visual and interaction behavior (zoom, expand/collapse,
detail panel, theme switching, responsive layout) is verified by running
`next dev` and checking in a browser during implementation — not
automated in this round, consistent with the Non-goals above.

## File structure (new/changed)

```
src/
  app/
    layout.tsx            # modified: font stays, add theme inline script + ThemeProvider
    globals.css            # modified: theme CSS variables + semantic utility layer
    page.tsx                # modified: drop unused LoginPage import
    loading.tsx              # modified: real spinner
    not-found.tsx             # modified: real 404
    error.tsx                  # modified: real error UI
    global-error.tsx            # deleted
    template.tsx                  # deleted
    default.tsx                    # deleted
    route.tsx                       # deleted
    page.module.css                  # deleted
    sidebar.tsx                       # modified: redesigned nav
    genealogy-tree/
      page.tsx                        # modified: new node renderer, zoom controls, search wiring, detail panel wiring
      treeData.json                    # deleted (unused duplicate)
      components/
        card.tsx                        # deleted
        Link/index.tsx                   # deleted
    login/page.tsx                        # modified: restyle only
    signup/page.tsx                        # modified: restyle only
    login/components/loginForm.tsx          # modified: restyle only
    signup/components/signupForm.tsx         # modified: restyle + remove console.log
  components/
    auth/
      AuthHeader.tsx                              # renamed from components/Header.tsx (avoid name collision with the new layout header)
    Input.tsx, FormAction.tsx, FormExtra.tsx    # modified: restyle only
    layout/
      Header.tsx                                 # new: app header (search + theme button); sidebar itself stays at app/sidebar.tsx
    theme/
      ThemeProvider.tsx                            # new
      ThemeSettingsPopover.tsx                      # new
    tree/
      TreeControls.tsx                               # new: zoom in/out/reset buttons
      MemberDetailPanel.tsx                           # new
  lib/
    parser.tsx                                        # deleted
    validators.tsx                                      # deleted
    theme/
      themes.ts                                          # new
      storage.ts                                          # new
    tree/
      search.ts                                            # new
  __tests__ or *.test.ts colocated                          # new: Vitest specs for lib/tree/search.ts, lib/theme/storage.ts
```

## Repo/setup notes

- `git init` already done; baseline scaffold committed at `9eee7ec`; this
  spec is the next commit.
- After implementation, run the `init` skill to (re)generate `CLAUDE.md`
  for this repo.
