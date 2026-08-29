# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install dependencies: `npm install`
- First-time setup: `cp .env.example .env` (sets `API_BASE_URL` for the `/api/*` proxy — see Architecture)
- Run the dev server: `npm run dev` (Turbopack) — needs `genealogy-api` also running locally (`uv run uvicorn app.main:app --reload` in that sibling repo, with its `FRONTEND_ORIGIN`/`.env` pointing back at this app) for auth (login/signup/logout) *and* the tree itself, which now fetches real data from `/api/members/tree` rather than reading a bundled file
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
tree (`react-d3-tree`) plus login/signup pages, both wired to the sibling
`genealogy-api` project. `Home` (`src/app/page.tsx`) fetches
`/api/members/tree` on mount and passes the result to `GenealogyTree` as
a prop — there is no bundled tree JSON anymore (`new_treeData.json` was
deleted once its content was migrated into the database via
`genealogy-api`'s seed script). A 401 from that fetch redirects to
`/login`; other failures show an inline error with a retry button while
the sidebar/header keep rendering normally. The API backing this is one
shared tree for every logged-in user — no per-user data. Editing the tree
(the backend already has full Member CRUD) has no frontend UI yet — that
remains a separate future piece of work (see `docs/superpowers/specs/`).

**Auth architecture — same-origin proxy, not direct cross-origin calls.**
`genealogy-api` runs on a different origin (`http://localhost:8000`) and
sets its JWT as an httpOnly cookie. For Next.js's own server
(`src/middleware.ts`) to see that cookie, the browser must never talk to
the backend's origin directly — `next.config.ts`'s `rewrites()` proxies
`/api/:path*` to `${API_BASE_URL}/:path*` so, from the browser's
perspective, the login response (and its `Set-Cookie` header) comes from
`localhost:3000` itself. **Every frontend fetch to the backend must go
through `/api/...`, never `http://localhost:8000` directly** — calling
the backend's origin directly would set a cookie the middleware can never
read. `src/middleware.ts` only checks whether the `access_token` cookie
is *present* on `/` and `/genealogy-tree` (redirecting to `/login` if
not) — it does not decode/verify the JWT, since that would require
sharing `JWT_SECRET` with the frontend; real validation happens on the
API when it's actually called.

**Theming is a runtime-switchable, CSS-variable system, not Tailwind's
`@theme` token registration.** `src/app/globals.css` defines one
`:root[data-theme="warm|modern|elegant"]` block per theme (colors only:
`--color-bg`, `--color-surface`, `--color-primary`, `--color-accent`,
`--color-text`, `--color-text-muted`, `--color-border`, `--color-on-primary`,
`--color-danger`), plus a `@layer components` block mapping them to
semantic utility classes (`bg-app`, `bg-surface`, `bg-primary`,
`text-default`, `text-muted`, `text-on-primary`, `accent-text`,
`text-danger`, `border-default`, and SVG-specific
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
`{name, children?}` shape (`FamilyMember`, `src/lib/tree/types.ts`) —
the same shape `GET /api/members/tree` returns (it also includes an
`id` per node, which `FamilyMember` doesn't declare and nothing here
currently reads — TypeScript's structural typing allows the extra field
through untyped) — with no react-d3-tree dependency.

**Tree data has only a name and children** — the backend's `Member` model
has no birth/death dates, gender, or notes fields. The member detail
panel (`src/components/tree/MemberDetailPanel.tsx`) only shows what that
data actually has (name, generation, ancestor breadcrumb, children);
don't invent fields the data doesn't contain.

**`FormAction` (`src/components/FormAction.tsx`) must not receive a
`handleSubmit` prop when used inside a `<form onSubmit={...}>`** — its
button is `type="submit"`, so passing the same handler as `onClick` too
fires it twice per submit. `loginForm.tsx`/`signupForm.tsx` rely on the
form's `onSubmit` alone; follow that pattern for any new auth-style form.

## Testing

Vitest covers pure logic only (`src/lib/**/*.test.ts`) —
`src/lib/tree/search.test.ts` runs in the default `node` environment;
`src/lib/theme/storage.test.ts` needs `// @vitest-environment jsdom` (a
per-file pragma) since it touches `window.localStorage`. There is no
component/E2E test setup (no React Testing Library, no Playwright
config) — UI and interaction behavior (theme switching, zoom/pan,
expand/collapse, search-and-center, the detail panel) is verified by
running `npm run dev` and checking it in a browser, not automated.
