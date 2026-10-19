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

**Docker:** `next.config.ts` sets `output: 'standalone'` and `Dockerfile`
here is a multi-stage build producing that standalone bundle. **`API_BASE_URL`
must be passed as a Docker build ARG, not just a container-run env var** —
`next build` resolves `rewrites()`'s destinations into a static routes
manifest baked into the standalone output; the production `server.js` does
*not* re-read `API_BASE_URL` at container start the way `next dev` re-reads
`.env` on every dev-server launch. `../docker-compose.yml` (see
`../DOCKER.md`) passes it correctly via `build.args`; building this
Dockerfile directly without that arg silently falls back to
`http://localhost:8000`, which is wrong inside a container network.
`docker-compose.yml` *here* runs the frontend alone (`web`, production build,
or `web-dev` with hot reload under `--profile dev`); it reaches the API at
`http://api:8000` over the shared `genealogy_dev` network that
`../genealogy-api/docker-compose.yml` creates — **not** via
`host.docker.internal`, because an API published on `127.0.0.1:8000` is
unreachable from another container through the host gateway. Everything about
the three compose files is in `../DOCKER.md`.

## Architecture

Next.js 15 App Router / React 19 / Tailwind v4 app: an interactive family
tree (custom `TreeCanvas`: d3-hierarchy layout + d3-zoom pan/zoom) plus a login page and the invitation page (no public sign-up), wired to the sibling
`genealogy-api` project. `Home` (`src/app/page.tsx`) fetches
`/api/members/tree` on mount and passes the result to `GenealogyTree` as
a prop — there is no bundled tree JSON anymore (`new_treeData.json` was
deleted once its content was migrated into the database via
`genealogy-api`'s seed script). A 401 from that fetch redirects to
`/login`; other failures show an inline error with a retry button while
the sidebar/header keep rendering normally. The API backing this is one
tree of the signed-in user's family (see "Several families on one deployment" below). The member
detail panel supports renaming, adding a child, deleting, reparenting,
and managing spouses (the empty state supports creating the first
member) — all these call `genealogy-api`'s Member/Marriage CRUD
endpoints directly and trigger a **silent** tree refetch on success
(see the `loadTree({ silent: true })` note below).

**Reparenting** — the edit form's "Cha/Mẹ" `<select>` only appears when
`getReparentCandidates` (`src/lib/tree/search.ts`) returns a non-empty
list; it excludes the member itself and all of its descendants (client-
side cycle prevention, mirroring the backend's own `_is_descendant`
check) and only ever lists blood-line members (spouses are never
parent candidates). For the tree's root member specifically, every
other member is by definition its descendant, so the candidate list is
always empty and the field simply doesn't render — no separate
`isRoot` flag needed. **A successful reparent closes the detail panel**
instead of trying to patch `ancestorPath`/`generation` locally — moving
a member changes its position in the tree, and those two fields are
computed from the *old* position; closing the panel and letting the
next click re-derive them from the refetched tree avoids reintroducing
the same class of staleness bug already documented below for renames.

**Spouses (`MemberDetailPanel`'s "Vợ/chồng" section)** — a member can
have zero or more spouses (`PanelSpouse[]`, converted in
`components/tree/GenealogyTree.tsx`'s `toPanelSpouses` from the API's snake_case
`Spouse` shape). Each row has its own inline edit mode (name, birth
year, death year, gender, notes, marriage year — one `SpouseDraft` per
row, only one row editable at a time) submitted as a single `PUT
/api/members/marriages/{marriageId}`; a plain name + marriage-year form
adds a new spouse via `POST /api/members/{memberId}/marriages`.
**Deleting a spouse calls `DELETE /api/members/{spouseId}`** — the same
endpoint used to delete any member — not a marriage-specific endpoint;
the backend's `ON DELETE CASCADE` removes the marriage link as a side
effect. Spouses never appear on the tree itself — they exist only in
this panel.

**Avatars** — the detailed `MemberCard` (`src/components/tree/MemberCard.tsx`)
draws a circular portrait (SVG `<clipPath>` + `<image>`) when `avatar_url`
is present, or a circle with the member's first initial otherwise; `MemberDetailPanel`'s `AvatarOrInitial` helper
does the same at a larger size for the display/edit views. The upload
flow is bundled into the existing "Sửa" form rather than being its own
sub-form: picking a file only sets local state
(`avatarFile`/`avatarPreviewUrl` via `URL.createObjectURL`, revoked on
every subsequent change or unmount-equivalent reset) — nothing is sent
until "Lưu" is clicked. `handleSave` then does the avatar mutation
first (`POST /api/members/{id}/avatar` as `multipart/form-data` if a
new file was picked, or `DELETE /api/members/{id}/avatar` if "Xoá ảnh"
was clicked with no replacement), and only then sends the normal JSON
`PUT` for the other fields — the general member-update endpoint never
carries the avatar. **All of `components/tree/GenealogyTree.tsx`'s mutation
handlers that update `selectedMember` from its previous value use the
functional `setSelectedMember((prev) => ...)` form, not
`setSelectedMember({ ...selectedMember, ... })`** — this was a real bug
(not just style): saving a new avatar and the text fields in the same
"Lưu" click fires two state updates back-to-back, and the second
handler's closure still held the pre-upload `selectedMember` snapshot,
silently reverting the just-set `avatarUrl`. Follow the functional-update
pattern for any new handler that mutates `selectedMember` based on its
existing fields.

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

`next.config.ts`'s `rewrites()` has a second rule, `/uploads/:path*` →
`${API_BASE_URL}/uploads/:path*`, for the same reason as `/api/*` but
for a different concern: it keeps `avatar_url` values (e.g.
`/uploads/avatars/<uuid>.jpg`) usable as relative `<img src>`s instead
of hardcoding the backend's origin into the frontend.

**Theming is a runtime-switchable, CSS-variable system, not Tailwind's
`@theme` token registration.** `src/app/globals.css` defines one
`:root[data-theme="heritage|warm|modern|elegant"]` block per theme
(`heritage` is the default and is also what plain `:root` resolves to; colors
and shadows only: `--color-bg`, `--color-surface`, `--color-primary`,
`--color-accent`, `--color-text`, `--color-text-muted`, `--color-border`,
`--color-on-primary`, `--color-danger`, plus the heritage-era tokens
`--color-secondary`/`--color-on-secondary`, `--color-tertiary`,
`--color-connector`, `--color-grid`, `--color-surface-muted`,
`--color-tier-ancestor|mid|descendant`, `--color-living`, `--color-deceased`,
`--shadow-card`, `--shadow-float` — every theme must define all of them), plus a block of Tailwind v4 **`@utility`** definitions mapping them to
semantic utility classes (they must be `@utility`, not plain classes in
`@layer components`: only `@utility` classes get variants such as `hover:` /
`focus-visible:` / `placeholder:`; opacity modifiers like `bg-surface/90` do
not work on them at all — use `bg-glass` for the translucent surface) (`bg-app`, `bg-surface`, `bg-primary`,
`text-default`, `text-muted`, `text-on-primary`, `accent-text`,
`text-danger`, `border-default`, and SVG-specific
`fill-surface`/`fill-border`/`fill-primary`/`fill-on-primary`/`fill-text`/
`stroke-border`/`stroke-accent`, and the newer `bg-secondary`,
`text-on-secondary`, `bg-surface-muted`, `fill-muted`, `fill-tertiary`,
`fill-/stroke-secondary`, `fill-/stroke-connector`, `stroke-primary`,
`font-display` (Noto Serif, names/headings), `font-ui` (Be Vietnam Pro),
`shadow-card`, `shadow-float`). Design source: `../design/heritage_tree/DESIGN.md`
and `docs/superpowers/specs/2026-10-17-heritage-redesign-design.md`. **Every new component should use these
semantic classes, never a raw Tailwind color utility** — that was the
whole point of introducing them (the pre-redesign codebase hardcoded
`purple-600`/`gray-*` everywhere, which is what made a color-only reskin
impossible without touching every component).

The theme choice is persisted in `localStorage["genealogy-web:theme"]`
(`src/lib/theme/storage.ts`) and applied via a `data-theme` attribute on
`<html>`. `src/app/layout.tsx` sets that attribute **twice**: once
synchronously via an inline `<script>` before hydration (it must list the
same theme ids as `isThemeId` in `src/lib/theme/themes.ts`; a stored choice
always wins over the heritage default) (to avoid a flash
of the wrong theme), and once reactively from `ThemeProvider`
(`src/components/theme/ThemeProvider.tsx`) after mount. `<html>` has
`suppressHydrationWarning` — the inline script's DOM mutation genuinely
doesn't match the server-rendered HTML, and that particular mismatch is
expected and safe to suppress (React's hydration warning about it is
otherwise a false positive, not a real bug).

**Never put a prop-driven component in a route file** (`src/app/**/page.tsx`):
`next build` prerenders every route without props, so the build crashes if the
component dereferences them — dev mode never prerenders, so it only shows up in
`npm run build` / the Docker image. `GenealogyTree` therefore lives in
`src/components/tree/GenealogyTree.tsx`, and the old `/genealogy-tree` route just
redirects to `/`. Run a production build (or `docker compose build web`) before
merging anything that touches the tree.

**The tree canvas (`src/components/tree/TreeCanvas.tsx`) is built for large
trees (the real tree is ~700 members; measured in headless Chromium with
software rendering at 2,000 and 5,000 synthetic members, fully expanded, p95
frame time ≈ 16.7ms at k=0.2/0.6/1.2, and with mocked per-member detail
responses arriving during fast panning; not yet measured on a real laptop).** Rules that
keep it fast — don't undo them casually:
- **Pan/zoom never re-renders the cards.** The live transform lives in
  `transformRef` and is written straight to the content `<g>`; React state
  (`committed = {rect, level}`) only changes when `needsRecommit`
  (`src/lib/tree/viewport.ts`) says the visible set can change (viewport left
  the committed rect — `VISIBLE_MARGIN` 0.5 screens per side — or the zoom
  level changed). Handle methods (`centerOnNode`, `fitToView`, ...) must read
  `transformRef`, never the React state.
- **Three zoom levels** (`zoomLevelFor`, `src/lib/tree/zoom.ts`): dot
  `k<0.4`, compact `0.4..0.8`, detailed `>0.8`. `MemberCard` renders each.
  Layout is **fixed** to the detailed card's slot (`NODE_SIZE` 272x206,
  `SEPARATION` 1/1.25 in the tree page) and never changes with the level.
  Dots/junctions keep a constant screen size and compact cards scale up (to
  1.6x) while zoomed out through the `--inv-k` CSS variable set in the zoom
  handler — CSS only, no React work per frame.
- All links are one `<path>` (`vector-effect: non-scaling-stroke`); there is
  no framer-motion or per-node animation. The minimap is one `<canvas>`.
- The zoom floor is dynamic (`minZoomFor`): lower than 0.15 when needed so
  "Toàn cảnh" (`fitToView`) can always fit the whole expanded tree; fit uses
  per-side padding (`FIT_PADDING`) to stay clear of the floating bars, and a
  current zoom that falls below a new floor is pulled back in (`clampZoom`).
  The container is observed with a `ResizeObserver`, which recomputes the
  culling rect, the zoom floor and the minimap frame. d3 transitions and
  momentum are skipped under `prefers-reduced-motion`.
- The tree **opens on its first four generations** (`DEFAULT_GENERATIONS`, `defaultDepth`); the
  generation stepper (`GenerationFilterBar`) sets "expanded down to Đời N" via
  `collapsedIdsForDepth`, and search/focus/ancestor-view first call
  `expandPathTo` so the target exists in the layout, then centre through the
  `pendingCenter` state + effect (not `requestAnimationFrame`, which can fire
  before React re-renders). A silent refetch keeps the user's collapse state.
- **Per-member detail** (years, spouses, avatar) is one request per member
  (no batch endpoint). Both the 3-hop focal set (`lod.ts`, first) and members
  visible at the compact/detailed level (nearest the view centre first) go
  through one pump, at most `DETAIL_FETCH_CONCURRENCY` (6) in flight
  (`pickIdsToFetch`, `src/lib/tree/detail-queue.ts`). Failed fetches are
  remembered (`failedDetailIds`) and never auto-retried (only the panel's
  retry button does); cards then show unknown styling, not a skeleton.
- A card's expand/collapse control (`ToggleControl`, which also holds the
  clickable "N hậu duệ" tag) is a **sibling** of the card's `role=button`
  group, never a child — buttons' children are presentational for screen
  readers. Keyboard focus is drawn by re-stroking `.tree-card-frame` (see
  `globals.css`); `ViewportControls`/`StatusStrip` subscribe through the
  `canvasHandle` state in `GenealogyTree` (no polling).
- `MemberCard` is `React.memo`; keep `onSelect`/`onToggle` stable
  (`useCallback`) or memoisation is lost. Selection is by id
  (`handleSelectMember` resolves the path from the *real* root, so it also
  works in the ancestor view).
- Member status: `memberStatus`/`lifespanLabel`
  (`src/lib/tree/member-status.ts`) — "living" only with a birth year, no
  death year and born within 100 years; otherwise unknown ("1850 – ?").
- **Load-testing:** in development, `/?synthetic=2000` swaps the API for a
  generated tree (`generateSyntheticTree`) and disables detail fetching; add
  `&details=1` to keep detail fetching on (point it at a mocked
  `/api/members/{id}` to measure the fetch path).

**Search/lookup logic is pure and tested independently of the tree UI**:
`src/lib/tree/search.ts` (`findMembersByName`, `findPathToMember`,
`generationOf`, `getMemberAtPath`) operates on the plain
`{id?, name, children?}` shape (`FamilyMember`, `src/lib/tree/types.ts`)
— the same shape `GET /api/members/tree` returns — with no rendering
dependency. `id` is optional on the type (existing tests construct
`FamilyMember` literals without one) but always present on real API data
— the CRUD mutation handlers in `components/tree/GenealogyTree.tsx` depend on it
being there.

**Two gotchas hit while adding member mutations (rename/add child/delete),
worth re-reading before touching this flow again:**
- `Home`'s `loadTree()` (`src/app/page.tsx`) takes a `{ silent?: boolean }`
  option. The initial page-load call omits it (shows the full-screen
  spinner, correct for a true first load), but every post-mutation
  refetch passes `{ silent: true }`. Without that, `isLoading` becoming
  `true` again flips the render guard (`{!isLoading && ... && <GenealogyTree ...>}`)
  and **unmounts `GenealogyTree` entirely** for the duration of the
  refetch — closing the open detail panel and losing zoom/pan/collapse
  state on every single edit, even though the fetch itself is fast.
- `handleRenameMember` (`components/tree/GenealogyTree.tsx`) must update the *last
  entry* of `selectedMember.ancestorPath` to the new name, not just
  `.name` — `ancestorPath` includes the member's own name as its last
  element by design, and `handleSelectChild`'s child-navigation does a
  name-based path lookup (`getMemberAtPath`) against the freshly-fetched
  tree. Forgetting this makes navigating to any child *after* a rename
  silently fail (the stale old name no longer matches), leaving the panel
  pointed at the just-renamed member instead of the clicked child — which
  then surfaces as a *second*, confusing `DELETE` 409 if the user then
  tries to delete what they think is the child.

**Roles and access (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-17-roles-and-admin-design.md`)** —
the API has roles (`admin` | `member`) and account statuses; the frontend mirrors them in
`src/lib/auth/session.ts` (`canEdit` = admin only, Vietnamese error/notice texts) and
`src/components/auth/useSession.ts` (fetches `/api/auth/me`; `user === null` means a guest or
logged out; `isBlocked` = the account was disabled/not approved while a cookie was still around, so
the page signs out). `Home` passes `canEdit` to `GenealogyTree` → `MemberDetailPanel`, which hides
every edit/add/delete control when it is false (the API refuses the writes anyway — never rely on
the hidden buttons for security). `src/components/layout/AppShell.tsx` (sidebar + header) is shared
by the tree page and `/admin`; `Header` shows the signed-in user and role, or "Đăng nhập" for guests,
and `Sidebar` shows "Quản trị" only to admins. `/admin` (`src/app/admin/page.tsx`, panels in
`src/components/admin/`) has Users (approve, role, disable, create) and Settings (visibility,
registration mode); it sends non-admins back to `/`. **`src/middleware.ts` only protects `/admin`** —
`/` must stay reachable without a cookie so guests can browse a public site; on a private site `Home`
redirects to `/login` itself when the API answers 401. Pitfalls: Next injects an empty
`next-route-announcer` with `role="alert"`, so tests/selectors for error messages must be scoped
(`form [role=alert]`); and in `UsersPanel` an error must be set *after* `load()` (which clears it).

**Several families on one deployment (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-17-multi-tree-design.md`)** —
every user belongs to one family tree (`CurrentUser.tree_id`/`tree_name`; null for the platform
`superadmin`, whose role label is "Quản trị tối cao"); `canManage`/`canEdit` are true for `admin` and
`superadmin` (`src/lib/auth/session.ts`). The frontend never sends a tree id: a signed-in user's tree
comes from their account (a superadmin picks the family with the header's **`TreeSwitcher`** — shown only with two or more families —
which sets the `acting_tree` cookie (`actingTreeCookie`, `src/lib/platform/trees.ts`) and reloads; the API reads
that cookie only for a superadmin). Guests and
the login context need to know which family they mean: **`/t/<slug>`** (`src/app/t/[slug]/route.ts`) sets the
`tree_slug` cookie (validated by `isValidTreeSlug`, `src/lib/auth/tree.ts`) and redirects to `/` with a
*relative* `Location` (behind a proxy the request's own origin is not the public one). (`/api/site/info`
answers 404 with several families and no cookie.) Trees and
their first admin are created on **`/he-thong`** (`src/app/he-thong/page.tsx`, `TreesPanel`; superadmin only, sidebar item
"Các họ"): list with counts and admins, "Xem cây"/"Quản trị" (switch to that family, then open `/` or `/admin`), rename
(slug included), and a create form that suggests the slug from the name (`slugify`) and shows the generated admin
password **once**. `scripts/manage.py` remains for `set-role superadmin` and scripting. Avatars are fetched through
the same `/uploads/*` proxy, but the API now checks access per file, so an `<img>` of another family's photo simply 404s.

**Member detail fields** — each member's `MemberDetail` (fetched per member
from `GET /api/members/{id}`, not part of the tree skeleton) carries
`birth_year`, `death_year`, `gender` (`'male' | 'female' | 'other'`, see the
`Gender` type in `src/lib/tree/types.ts`), `notes`, `avatar_url` and
`spouses`, all nullable/empty-able. Display mode in `MemberDetailPanel`
renders `lifespanLabel` (`"1950 – 2020"`; `"1950 – nay"` only for someone
born within the last 100 years with no death year; `"1850 – ?"` for an older
birth year with no death year), a gender label, and a notes block, each only
when present. Edit mode (`Sửa`) expands into a full form — name,
birth year, death year, gender dropdown, notes textarea — submitted as a
**single `PUT`** via one `MemberUpdateInput` (`onUpdate` prop), unlike the
add-child form which stays name-only. `components/tree/GenealogyTree.tsx` opens a
member by id (`handleSelectMember`/`handleSelectChild` → `openMemberDetail`),
fills the panel from `ensureMemberDetail`'s cache (snake_case, as the API
returns it) and converts it to the panel's camelCase props. The panel is
rendered with `key={selectedMember.id}` so edit-form state can never leak from
one member onto another — keep that key. Below `xl` the panel is a modal
overlay: it takes focus on open, traps Tab, restores focus to the opener on
close, and a backdrop click/Esc never discards an edit in progress.

**Profile fields (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-17-member-profile-fields-design.md`)** —
`MemberDetail` also carries `courtesy_name` (tên tự), `title` (chức vị),
`residence`, `burial_place`, `burial_latitude`/`burial_longitude` and a
**computed** `sibling_rank` ("Trưởng nam", "Thứ nữ", "Út nam"...). The
panel shows them in a "Thông tin" list (tab "Tiểu sử", with a Google Maps
link when GPS is set), the header shows `Tự: … · chức vị` and the rank, and
the edit form edits all of them; GPS is validated by `coordinatesFromInputs`
(`src/lib/tree/profile.ts`: both-or-neither, ranges, decimal comma accepted)
before the `PUT`. **`PUT /api/members/{id}` is a full replacement — always
send every field** (`handleUpdateMember` does). The detailed tree card shows
the rank next to the "Đời N" badge. Because a rank depends on *other*
members, after any edit that can change it (an edit, add child, delete,
reparent) `refetchDetails()` clears the fetch memory and re-requests the
visible/focal members; the old data stays on screen until the fresh
response replaces it.

**GĐ2: full profile data and the data-entry page (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-17-gd2-profile-data-design.md`)** —
`MemberProfile`/`PanelProfile` (`src/lib/tree/types.ts`) now also carry `hometown`, `phone`/`email` (null for guests), partial
dates (`birth_month/day`, `death_month/day`, lunar and leap flags — a month or day can be known without a year; death defaults to
lunar), `birth_order`, `is_adopted` and `mother_id`. **Add every new profile field to `toPanelProfile`/`profileToPayload`
(`src/lib/tree/profile.ts`, covered by a round-trip test) — `PUT` is a full replacement, so a field missing from the payload is wiped.**
Dates are shown by `formatPartialDate` (`src/lib/tree/dates.ts`: "15/08/1945", "12/03 âm lịch", a bare year without suffix); the panel's
edit form has two `DateFields` (month, day, "Âm lịch", "Tháng nhuận") under the year inputs. "Mẹ" is a select of the **father's
recorded spouses** (`motherOptions`, loaded from the father's detail in `GenealogyTree.openMemberDetail`); it is hidden and reset to
"none" whenever the father changes, because the API rejects a mother who is not the father's spouse. The data-entry page
**`/nhap-lieu`** (`src/app/nhap-lieu/page.tsx`, admins only — middleware needs a cookie and the page redirects non-admins to `/`;
sidebar item "Nhập liệu") is `src/components/data-entry/DataEntry.tsx`: a paged grid over `GET /api/members/table` (filters: name,
generation, "missing X" chips, one branch via `under`), a completeness bar from `/api/members/completeness`, **one `PATCH` per cell**
(`EditableCell`: blur/Enter saves only when changed, Esc reverts, a refused value stays visible with `role=alert`), "Tách" (split
"N vị", `SplitDialog`), CSV export (a plain link to `/api/members/export.csv`) and `ImportPanel` (dry run first, then "Áp dụng"; a
rejected file lists every bad row and imports nothing). Pure logic (query string, cell parsing, split names, import errors) is in
`src/lib/data-entry/` with tests; the grid renders names as `<input>`s, so Playwright rows must be located by `aria-label`, not text.

**GĐ3: search, branches (chi/phái) and statistics (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-18-gd3-search-branches-design.md`)** —
`foldText` (`src/lib/text.ts`) mirrors the API's `fold()`: the header search
now goes through `usePersonSearch` (the API's ranked search, 8 rows of "name · đời N · con X" — the same box logic as `PersonPicker`; the dev-only synthetic tree keeps the in-page `findMembersByName`), and its dropdown ends with a "Tìm nâng cao" link to **`/tim-kiem?q=…`** (`SearchView`: name, generation,
branch, birth years, hometown, gender, status; results paged by 30 from `GET /api/members/search`, spouses included and marked,
"Có phải bạn muốn tìm…" suggestions when nothing matches). Choosing a result goes to **`/?focus=<id>`**: `Home` consumes the
parameter once (reads `window.location.search`, not `useSearchParams`, to avoid a Suspense boundary; then `replaceState`) and turns
it into a `focusRequest`; a spouse result leads to the partner because the tree shows blood members only. **Branches:** `Home`
fetches `/api/branches` after the tree (a failure must never break the tree) and passes `branches` to `GenealogyTree`, which
computes `assignBranches` (`src/lib/branches/branches.ts`, deepest head wins — same rule as the API) and gives each `MemberCard` a
`branchColor`/`branchName` (a 4px strip inside the card's left edge; a coloured ring on dots) — keep those props primitive or the
card's `React.memo` is lost. `BranchChips` (under the generation bar; the ancestor-view button moves down when it shows) flies to a
branch head through `focusOn`; the panel shows "Thuộc chi" from `MemberDetail.branch`. **`/chi-phai`** (`BranchesView`, readable by
everyone who can read the tree) shows overall figures from `/api/stats` and one card per branch from `/api/stats?branch=ID`; admins
add/edit/delete branches (`BranchForm` picks the head by searching, spouses excluded). Sidebar items "Tìm kiếm" and "Chi phái".

**GĐ4: change requests and the audit log (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-18-gd4-change-requests-design.md`)** —
a signed-in non-admin gets **"Đề xuất chỉnh sửa"** in the panel instead of "Sửa" (`canPropose` = signed in and not `canEdit`,
passed `Home` → `GenealogyTree` → `MemberDetailPanel`, which now also takes `memberId`). `ProposeDialog` has three tabs (edit / add
child / report); the edit form is pre-filled from the panel's own data (`formFromPanel`, `src/lib/requests/requests.ts` — a test keeps it
equal to `formFromDetail`) and **only changed fields are sent** (`changesFromForm`: blank → `null`, numbers range-checked like the API).
**`/yeu-cau`** (`RequestsView`) is one page with two faces: admins get "Chờ duyệt / Đã xử lý", an old→new table per request, a
"đã đổi từ lúc gửi" warning (`diff[].stale`) and Duyệt / Từ chối (a reason is required to reject); everyone else sees their own requests,
the decision and the reviewer's note, and can withdraw pending ones. The sidebar item "Yêu cầu" polls `/api/requests/summary` once and shows a
badge (`usePendingRequests`; failure just hides it). **`/nhat-ky`** (`AuditView`, admins; `?member=<id>` filters, linked from the panel's
"Lịch sử") renders `GET /api/audit` with `changeLines` ("Năm sinh: 1930 → 1931") and `actionLabel`. When you add a profile field, add
its Vietnamese label to `FIELD_LABELS` and the form lists in `requests.ts`, or it shows up under its raw key. In Playwright `ol li` also
matches the nested change lines — use `ol > li`.

**GĐ5: calendar, giỗ, reminders (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-18-gd5-calendar-design.md`)** —
**`/lich`** (`CalendarView`, readable wherever the tree is; sidebar "Lịch giỗ") shows a Monday-first month grid (`monthGrid`) with the
**lunar day under every solar day** (`lunarLabel`: "1/9" on a lunar month's first day), coloured chips for giỗ (filled) and events, a day
detail, a 60-day "Sắp tới" list, and cards: `ConverterCard` (solar↔lunar, a nonexistent leap month is explained), `SubscribeCard` (the
secret `.ics` link: everyone signed in can copy it, admins enable / replace / switch off; the URL is `${origin}/api${path}`) and
`ReminderCard` (days before + email; saved on every change). Admins add/edit/delete events in `EventDialog` (`eventPayload` mirrors
the API's rules; opened from a day it pre-fills that solar date). `/lich?ngay=YYYY-MM-DD` (the link of a notification) opens that month
with the day selected (`parseDayParam`). The header has `NotificationsBell` (polls `/api/notifications` every 5 minutes; opening the
list marks all read and the count drops at once) and the tree page `UpcomingStrip` (next 3 within 30 days, md+ only, hidden while a
panel is open or in synthetic mode). The worker that creates the notifications is a separate compose service — without it the bell
stays empty. Playwright: day cells have an `aria-label` "dd/mm/yyyy, âm lịch N, K mục"; the converter's section label contains "Ngày âm",
so label selectors need `{ exact: true }`.

**GĐ6: media gallery and places (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-18-gd6-media-places-design.md`)** —
the panel's **"Tư liệu & bút tích"** is `MediaGallery` (`src/components/media/`, also used on a place): thumbnail grid, PDFs as tiles that open in a
tab, a lightbox viewer (arrow keys, "Mở ảnh gốc"), and for admins a multi-file upload (`uploadProblem` pre-checks type/size; the API checks the
content again), caption (`prompt`) and delete. It is rendered only for signed-in users (`signedIn` prop) because the API never serves media to
guests. **"An nghỉ"** in the profile shows the place (link to `/dia-diem?place=ID`), the plot and a "Chỉ đường" link (`directionsUrl`); the
admin's edit form has a place select (fetched from `/api/places` only while editing) and a plot field; `profileToPayload` carries
`burial_place_id`/`burial_plot` (PUT replaces everything). `GenealogyTree` keeps `restingPlace` fresh when the detail is refetched. **A modal
dialog owns Esc**: the panel's Esc handler returns when any `[role=dialog][aria-modal=true]` is open, otherwise closing the photo viewer
would also close the panel. **`/dia-diem`** (`PlacesView`, signed-in only, sidebar "Địa điểm"): list + kind filter + search, a Leaflet map
(`PlaceMap`, **loaded with `dynamic(..., { ssr: false })`**, OpenStreetMap tiles, no API key, `divIcon` markers because Leaflet's default icon
images break under bundlers), a place card with caretaker, visit notes, residents (links to `/?focus=`), photos and directions; admins add/edit/delete
places — "Chọn toạ độ trên bản đồ" turns the next map click into latitude/longitude — and run the migration of the old "mộ phần" text
(preview, then apply). **Leaflet zoom/fade animations are turned off on purpose**: its zoom-animation timer fires after `map.remove()` and throws when
the user leaves the page mid-animation. The event dialog can pick a place; the calendar then links it.

**GĐ7: chronicles and the phone menu (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-19-gd7-chronicles-design.md`)** —
**`/su-ky`** (`ChroniclesView`; sidebar "Sử ký"; guests of a public site can read it) has three tabs: articles (kind filter chips; pinned/draft badges), the
timeline (century headings, `formatTimelineDate`) and the bài đệm (a rows editor, `wordsPayload`). Admins write with `ArticleEditor`: a Markdown textarea with
a live preview, photo upload (a new article is saved as a draft first so photos have somewhere to live), "Chèn" inserts `![caption](media:ID)` at the cursor,
"Làm ảnh bìa", and a `PersonPicker` (`components/common/`, search-as-you-type) for the people mentioned; `/su-ky?sua=ID` / `?moi=1` open the editor from the
reader / empty state. **`/su-ky/[slug]`** (`ArticleReader`) is the reading page. **Markdown is rendered by our own parser** (`src/lib/markdown/markdown.ts` →
`MarkdownView`): headings, emphasis, `code`, lists, quotes, rules, links and `media:` images, built as React elements, so raw HTML is never interpreted — a
`<script>` stays text and a link target must be http(s), mailto or a site path (`safeHref`); a remote image URL is never embedded. Guests get `media = null`,
so a `media:` image degrades to its caption (the API would refuse the file anyway). The panel shows "Được nhắc trong…" (published articles mentioning the
person; drafts marked for admins) and, for admins adding a child, the bài đệm hint "Chữ đệm đời N: …". **Phones:** below `md` the sidebar is replaced by a
drawer opened from the header's "Mở menu" button (`AppShell` keeps `menuOpen`; `Sidebar` renders the same entries — a data-driven `entries` list with a
`show` flag — as an `aside` at `md+` and a dialog below; Esc, the backdrop and choosing an item close it). Add a new page to that list, and flip
`show` only once the page exists (no dead links).

**GĐ8: statistics (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-19-gd8-statistics-design.md`)** — **`/thong-ke`** (`StatsView`; sidebar "Thống kê")
shows key-number cards, bars for people per generation and births per decade, gender, lifespan, children, the longest line, common names, branches and the
**completeness board**. There is no chart library: a bar is a link (`widths()` scales it) whose `aria-label` carries its figures ("Đời 3: 3 người (nam 2, nữ 1)"), so
meaning never depends on colour. **Every bar leads to work:** the search page reads its filters from the address (`filtersFromSearch`: `generation`, `gender`,
`status`, `born_from`/`born_to`, `branch`, `hometown`, `q`; unknown values are ignored) and the data-entry grid reads `?missing=gender,avatar&generation=3`
(`filtersFromAddress`) — the board's "Bổ sung" links (admins only) open the grid already filtered to the people lacking that field. Only fields the grid can
filter on get a link (`completenessLink`). Playwright: the card labels are upper-cased by CSS, so match text case-insensitively.

**GĐ9: invitation cards (backend design: `../genealogy-api/docs/superpowers/specs/2026-10-19-gd9-invitations-design.md`)** — **`/thiep/[token]`**
(`InvitationView`) is **public on purpose**: no `AppShell`, no session, not in the middleware matcher; the secret token in the address is the access control.
It shows a card (family, event, weekday + solar date, **lunar date**, place with a directions link, the host's message, the totals) and the answer form
(Tham dự / Không / Chưa chắc, number of people for "yes", a note). On a card's open link the browser keeps the **personal token** the API returns in
`localStorage` (`storageKey`), so reopening the same link greets the guest with their answer and lets them change it (`Đổi câu trả lời`); a personal link greets
by name and needs no name. A closed card shows a notice instead of the form. Guest text is rendered as plain text by React (a `<img onerror>` in a name stays
text). Admins reach `CardsDialog` from an event in the calendar's day view ("Thiệp mời"): create a card for a date (the date must be an occurrence), copy the
shared link, add personal links (one name per line), see every answer with names/notes, close/reopen, download the CSV, delete a card.

**`FormAction` (`src/components/FormAction.tsx`) must not receive a
`handleSubmit` prop when used inside a `<form onSubmit={...}>`** — its
button is `type="submit"`, so passing the same handler as `onClick` too
fires it twice per submit. `loginForm.tsx` relies on the
form's `onSubmit` alone; follow that pattern for any new auth-style form.

**Forgot/reset password pages** (`/forgot-password`, `/reset-password`)
follow the same layout pattern as `/login` (an `AuthHeader` +
a client form component). `/forgot-password`'s form always shows the
same generic success message on any successful response — it never
reflects back whether the email was registered, matching the backend's
anti-enumeration behavior; don't "improve" this by showing a different
message for a failed lookup. `/reset-password`'s form reads `token`
from the query string via `useSearchParams()`, which requires wrapping
the form in a `<Suspense>` boundary in the page component — omitting it
makes `next build` fail with "useSearchParams() should be wrapped in a
suspense boundary". The "Forgot your password?" link in
`src/components/FormExtra.tsx` used to be a dead `href="#"` placeholder;
it now points at `/forgot-password`.

## Testing

Vitest covers pure logic only (`src/lib/**/*.test.ts`) —
`src/lib/tree/search.test.ts` runs in the default `node` environment;
`src/lib/theme/storage.test.ts` needs `// @vitest-environment jsdom` (a
per-file pragma) since it touches `window.localStorage`. There is no
component/E2E test setup (no React Testing Library, no Playwright
config) — UI and interaction behavior (theme switching, zoom/pan,
expand/collapse, search-and-center, the detail panel) is verified by
running `npm run dev` and checking it in a browser, not automated.

**GĐ10: export (backend: `../genealogy-api/docs/superpowers/specs/2026-10-19-gd10-export-design.md`)** — two things. (1) **"Xuất ảnh"** button in `ViewportControls` →
`ExportDialog` (scope: whole tree / a chi / descendants of the person whose panel is open; generation cap; years toggle; PNG or one-page PDF). All client-side:
`src/lib/export/tree-export.ts` prunes the tree, lays it out with `computeLayout` and draws **its own standalone SVG with explicit colours read from the active theme**
(never the on-screen DOM), then the dialog rasterises it through a canvas (`planRaster` caps the size: ≤12000 px a side, ≤60 Mpx, and warns when it had to shrink)
and the PDF is the JPEG wrapped by a minimal hand-written PDF (`buildPdf`, xref offsets tested). Years come from paging `/api/members/search` (signed-in only). Open to
anyone who can see the tree. (2) **`/xuat-ban`** (`BookView`, sidebar "Xuất bản", admins) downloads `GET /api/book.pdf` with the option checkboxes; `next.config.ts` raises
`experimental.proxyTimeout` to 300 s because a big family's book takes a while.

**GĐ11: kinship, privacy, view options, operations** — `RelationshipDialog` (panel → "Xem quan hệ họ hàng…", `lib/tree/relationship.ts`) asks `/api/members/relationship`; "Xem riêng nhánh này" reuses the
ancestor-view mechanism (`ancestorViewRootId`, now the person themself). **Horizontal tree**: `TreeCanvas` takes `orientation`; `computeLayout(..., orientation)` always receives `nodeSize` as
(lateral, depth) and swaps x/y for horizontal, `stepPath`/junctions/start offset follow, `slotSize` gives the per-axis size; the choice is kept in `localStorage` (`genealogy.tree.orientation`).
Admin → tab "Quyền riêng tư" (`PrivacyPanel`, `lib/privacy/privacy.ts`) edits `/api/admin/privacy`. 429 from login/register/forgot/RSVP shows `TOO_MANY_ATTEMPTS`.
`next.config.ts` adds security headers and — **production only** — a CSP (`'unsafe-inline'` scripts stay: Next hydration + the theme init script; map tiles from tile.openstreetmap.org; `data:`/`blob:` images
for the export). A new external image/script/connect origin must be added there or it fails silently in production (it works in `next dev`!); `/xuat-ban` also links the JSON export.

**Admin console (GĐ12)** — `/admin` is the home (to-do box from `/api/admin/overview`, a tile per area, a "Gần đây" strip); each area is its own page under `/admin/<area>` wrapped in
`AdminFrame` (guard + "← Quản trị" + h1 + desktop section list). **Register a new area in `src/lib/admin/sections.ts`** (`ready: true` only when its page exists, otherwise the tile is hidden).

**Admin users page** — `/admin/nguoi-dung` (`UsersView`): search (accents ignored), status/role filters (`?trang-thai=pending` from the home's to-do box pre-selects), cards on every width, last login ("Chưa ghi nhận" for no value),
linked person, password reset dialog (shown once, copy button), link dialog (`PersonPicker`), single "Duyệt" for an old pending account. Every role/status change goes through `components/common/ConfirmDialog` (Esc cancels, focus starts on "Huỷ").

**Admin audit and share pages** — the change log is ONE page, `/nhat-ky` (`AuditView`, in the left menu; `/admin/nhat-ky` redirects there via `next.config.ts`): kind chips, a "Người thực hiện" select (`GET /api/audit/actors`), date range, `?loai=security` from the home's lockout task; security rows carry a "Bảo mật" badge and a superadmin acting inside the family a "Quản trị hệ thống" badge (`actorBadge`). `/admin/link` is "Link lịch & thiệp mời" (`SharesView`: calendar link create/regenerate/off and
open invitation cards with "Đóng thiệp", each behind `ConfirmDialog`). `actionLabel` (Vietnamese text per audit action) lives in `lib/requests/requests.ts`; add new audit actions there.

**Data health page** — `/admin/suc-khoe-du-lieu` (`HealthView`, `lib/admin/health.ts`): findings grouped by kind (most certain first), each person a "Mở trên cây" link, a plain headline ("Dữ liệu ổn…" / "N chỗ cần xem lại"). `BADGE_KEY` in `sections.ts` maps tiles to to-do keys for count badges.
**Do not run `npm run build` while `next dev` is running from the same folder** — they share `.next` and the dev server stops rendering (delete `.next` and restart it).

**Backups are the platform owner's** — there is no backup page for a family admin any more (`/admin/sao-luu` redirects to `/admin`; the API's `/admin/backup-status` and the `backup_old` to-do are gone). `lib/admin/backup.ts` (`backupSummary`, `formatBytes`) now serves only the superadmin's system page.

**Admin console polish (phase 6)** — dialogs use `components/common/useDialogFocus` (focus moves in, Tab/Shift+Tab stay inside, focus returns to the opener; `ConfirmDialog` starts on the safe "Huỷ"). Contrast was audited on all four themes (heritage, warm, modern, elegant) at 375/768/1024/1440 px with
a script that composites real backgrounds: it found and fixed `warm`/`modern` `--color-text-muted` (now `#6f5f52` / `#56667c`, ≥ 4.5:1 on `surface-muted`) and chips that paired `bg-secondary`/`text-white` badly — **status/alert chips are a coloured border + `text-default`**, not a coloured fill, so they pass on every theme. Links that are text on the page background use `text-default` + underline (`text-primary` fails AA on `warm`).
Touch targets: radios/checkboxes inside a ≥ 44 px label count. Keep new admin text ≥ 14 px (body 16 px).

**No public sign-up (feedback batch, phase 4)** — `/signup`, `lib/auth/bootstrap.ts`, the `registration` setting block, "Duyệt tất cả" and the `pending_users` to-do item are gone; the login page has no Signup link. A fresh install's superadmin (made with the CLI) has no family: the home page's tree fetch answers 404, `emptyInstallTarget` (`src/app/page.tsx`, `lib/auth/landing.ts::landingPath`) then sends them to `/he-thong`.
**Invitations** — `/moi/<token>` (`InviteView`, public like `/thiep/*`: no `AppShell`, not in the middleware matcher) shows "Bạn được mời vào gia phả … với tư cách …" and a form (name, e-mail, password twice), then lands on `/?focus=<member id>`. Admin side: the person panel's "✉ Mời người này" opens `InviteDialog` (one request per opening; the link is shown **once** with a select-all fallback because `navigator.clipboard` needs HTTPS), **"Đây là tôi"** PATCHes the admin's own `member_id` (no approval), and `/admin/nguoi-dung` lists links with `InvitationsPanel` ("Thu hồi" behind `ConfirmDialog`). A linked account (`CurrentUser.member`) gets the header name as a "Hồ sơ của tôi" link (`/?focus=<id>`, a full navigation on the tree page because the tree reads `?focus` once), the tree focuses them once per browser session (`shouldFocusMe`, sessionStorage guarded), and the relationship dialog offers "Xem với tôi". The panel gets the account through `PanelMe` (`GenealogyTree` `me` prop + `onMeChanged` = session refresh).

**Superadmin console (GĐ13)** — `/he-thong` is the home (to-do box, platform numbers, tiles); each area is `/he-thong/<area>` inside `PlatformFrame` (superadmin guard, "← Nền tảng", h1, section list). **Register an area in `src/lib/platform/sections.ts`** (`ready: true` only when its page exists). The family list/create/rename UI (`TreesPanel`) lives at `/he-thong/ho`.

**Family life cycle UI** — the family card (`TreesPanel`) shows a status chip, last activity and `TreeActions`: pause/resume behind `ConfirmDialog`, and for a paused family "Xoá họ" opening `DeleteTreeDialog` (what goes, a link to the family's JSON export, the slug typed back; `lib/platform/lifecycle.ts::canDelete`). `?loc=khong-admin|tam-ngung` (from the to-do box) filters the list. Login shows "Họ của bạn đang tạm ngưng…" for `tree_paused`.

**Admins dialog** — "Quản trị viên" on a family card opens `AdminsDialog` (list with status/last login, add new with generated password shown once, promote a family member picked from `/api/admin/users` with `X-Tree-Id`, enable/disable behind `ConfirmDialog`, new password through `PasswordDialog` given an `endpoint`). The "Vô hiệu hoá" button is hidden for the last active admin (`lib/platform/admins.ts::canDisable`); the API enforces it anyway. Esc closes only the topmost dialog.

**Platform log page** — `/he-thong/nhat-ky` (`PlatformLogView`, `lib/platform/log.ts`: labels, one-line details, `buildEventsQuery`); the home shows the last 5 lines. **Every way into a family goes through `enterFamily`** (family card buttons, the header `TreeSwitcher`, the JSON export link in the delete dialog) so it is logged first; never set the `acting_tree` cookie directly.

**System page** — `/he-thong/he-thong` (`SystemView`, `lib/platform/system.ts`: one `Summary {tone ok|warn|neutral, headline, detail}` per card, no fetching in the helpers). Warn cards use a coloured border + "Cần chú ý" chip (not a coloured fill). The Hệ thống tile's badge follows the `worker_stale` task.

**Superadmin console polish (phase 6)** — the contrast/targets/keyboard audit (`gd14-p6` pattern: 4 themes × 4 widths × every `/he-thong` page, dialogs trap focus, Esc returns focus) is the same as the admin console's; the create/rename forms were raised to 44 px inputs and 16 px text. New platform dialogs must use `useDialogFocus`/`ConfirmDialog` and `enterFamily` for any way into a family.

**Feedback batch (19/10), phases 1–2** — **Header** (`Header.tsx`, `HeaderIconButton.tsx`): the signed-in name/role sits next to the family name (md+); settings (`ThemeSettingsPopover`) and sign-out are 44px icon buttons at the far right (`HEADER_ICON_BUTTON_CLASS`, `aria-label`); guests get "Đăng nhập". **Generation stepper** (`GenerationFilterBar`, `lib/tree/generationStepper.ts`): "Hiển thị đến đời" − / number / + = the deepest generation shown (absolute generation; min = the shown root's generation in a branch view, max = youngest in the shown subtree); `clampDepth` snaps bad input (empty/NaN → max); the tree opens on the first 4 generations (`defaultDepth(max) = min(max, 4)`), and so does a branch view (4 from the branch root; it forgets collapses inside it); the old chip row, `DEFAULT_EXPANDED_GENERATIONS` and `expandedDepthOf` use are gone. **Data entry** shows five fixed `CompletenessCards` (3 + 2; each a `button aria-pressed` toggling its "missing" filter; `lib/data-entry/completenessCards.ts`). **Panel**: "Con nuôi" is shown only when `canBeAdopted` (has a father; the data-entry "Nuôi" checkbox is disabled otherwise).
**Media** (`MediaGallery` + `UploadButton`, `MediaCard`, `lib/media/uploadQueue.ts|groups.ts`): one "Thêm ảnh hoặc tài liệu" button (hidden multi-file input, drag-and-drop on md+), `runUploads` (sequential; refused files are listed with the reason, the rest still go), cards in two groups (Ảnh / Tài liệu) with a ⋯ menu beside the caption (Esc closes only the menu — it stops propagation so the profile panel stays), caption dialog and `ConfirmDialog` instead of `window.prompt/confirm`; the lightbox ignores keys while another modal is on top. **Map link** (`MapLinkField`, `lib/places/mapLink.ts`): member form and place form take one `type=url` Google Maps link (`looksLikeMapLink` is only a hint; the API validates); the panel shows "Xem trên bản đồ" from the link, else from old coordinates (`mapHrefFor`). `handleUpdateMember` takes `burial_latitude/longitude/map_url` from the API's answer because the server derives the position from the link. The places form keeps "chọn vị trí trên bản đồ" (the map click still fills latitude/longitude) with a "Bỏ vị trí" button.

**Chronicle editor (feedback batch, phase 3)** — `ArticleEditor` writes with **`RichTextEditor`** (Tiptap 3 / ProseMirror, `next/dynamic` with `ssr:false`, so its ~440 kB chunk (134 kB gzip) loads only on the edit pages; `/su-ky` first load 140 → 142 kB). The article is still Markdown: `lib/chronicles/richText.ts` converts `markdownToDoc(md)` / `docToMarkdown(doc)` **against the reader's own parser** (`lib/markdown`), so "lossless" means `parseMarkdown(roundTrip(md))` equals `parseMarkdown(md)` (tested on samples, long chronicles and 6,000 random documents). The editor's schema only allows what the reader and the book know — headings 1–4, paragraphs, flat lists (`ListItem.content='paragraph'`), quotes of plain paragraphs, rules, bold, italic, `code`, links (`normaliseLinkInput`: http(s), mailto, site paths), `media:ID` images (`MediaImage` shows the article's photo); no hard breaks, strike, underline, code blocks or nested lists. **Backslash escapes** (`\*`, `\_`, `\[`, `\#` …) were added to `parseInline` and to the book's `_inline` (placeholder swap before the patterns run): the serializer writes them so a typed `*` or `_` stays text; old articles are unaffected (a backslash before an ordinary letter stays). Raw html/tables/fenced code are shown as plain text and `unsupportedPresent` triggers one notice. `EditorToolbar` is an ARIA toolbar (roving tabindex, `aria-pressed`, 44 px, `onMouseDown` keeps the selection), `LinkDialog`/`ImagePickerDialog` are not `<form>`s (the editor sits inside the article's form). The editor stays mounted behind the "Xem trước" toggle; the "Ảnh của bài" upload uses `UploadButton`.

**Gotcha: `?focus=` and Playwright** — on a first page load the tree centres on `/?focus=<id>` in a production build (`next build` + `next start`), but not under `next dev` (React strict mode runs the effects twice and the canvas has not been measured yet). Verify focus/"Hồ sơ của tôi" behaviour against a production build; Playwright suites that only click and read can use `next dev`.

**Profile panel and menu polish (20/10)** — **Sidebar** is in three sections (`lib/nav/sections.ts::navSections`: everyone's pages, then the admin's, then the platform owner's; a faint `--color-border` line between non-empty sections, in the desktop sidebar and the phone drawer — each `Entry` has a `group`). **Data entry** lost its "Thiếu …" chips: the five cards are the only "missing" filter (search, generation and the branch chip stay; the URL `?missing=` still works). **Panel layout** (`MemberDetailPanel`): `PanelSection` gives every block the same bold header with an accent bar and a line between blocks — Thông tin (name, courtesy name, chức vị, dates…), Hành trạng & công đức, Tư liệu & bút tích, Được nhắc trong (if any), Họ hàng (ancestor line, "Xem tổ tiên 4 đời", "Xem quan hệ họ hàng…"); no title/courtesy line under the name. The top has one row of `ActionTile`s (icon above the label): admins get Lịch sử / Sửa / Mời người này (+ a small "Đây là tôi" below for an admin who is not linked), members get "Đề xuất chỉnh sửa"; the close button is a bordered "Đóng" button. The bottom row is "Xem riêng nhánh này" on the left (only for a person with children, members too) and "Xoá thành viên" on the right (admins). `MediaGallery variant="panel"` draws the media inside the same tinted box as the notes: a small centred `UploadButton compact` with one short line, and "Chưa có tư liệu." (no upload) for members; the places page uses the default variant. "Hôn phối & con": name + short year + "Thêm" on one row for spouses, name + "Thêm" for children (same button column); the old "＋ Thêm …" quick actions and their focus machinery are gone.

**One person search everywhere (20/10)** — `components/common/usePersonSearch.ts` (debounced `GET /api/members/search`, ranked exact > prefix > word-prefix > contains, accents ignored; `personOptions` in `lib/search/search.ts` drops spouses and shapes the "đời N · con X" hint) feeds both `PersonPicker` and the header search. The tree-walk search that listed whole ancestor chains was removed. The panel no longer has "Xem tổ tiên 4 đời" (the ancestor line stays under "Họ hàng").

**Shell redesign (20/10)** — **Header** (`Header.tsx`): a 3-column grid — the family's name on the left (`familyName`, **the same on every page**; `AppShell` gets it from `useFamilyName(user)` = the account's family, the one a superadmin is acting in (`/api/trees` `is_current`), or the guest's site; only the platform console passes `title`), the search box exactly centred (`minmax(0,1fr) minmax(0,22rem) minmax(0,1fr)`, narrower at lg/md, its own row on phones), and on the right the signed-in name + role (xl and wider; it is the "Hồ sơ của tôi" link when linked; below xl the desktop sidebar carries "Hồ sơ của tôi") right next to the three icons: bell, colour theme (a palette icon), sign out. Pages are not named in the header any more: each view has its own `<h1>` (the tree page has an `sr-only` one). `useDismiss` (outside press / Esc) closes the bell list and the theme menu; their buttons use `headerIconClass(open)`. **Third colour — gold** (`--color-gold` per theme, utilities `bg-highlight`, `bar-gold`, `ring-gold`, `border-gold`): marks "you are here" — the current left-menu item (tint + 4px gold bar, same in the admin/platform side lists), an open header popover, the chosen theme. Text on it stays `text-default` and the bar/ring is a second cue, so contrast holds in all four themes (audited). **Admin console** now holds the settings-type areas only (Người dùng, Cài đặt họ, Quyền riêng tư, Link lịch & thiệp mời, Sức khoẻ dữ liệu); Nhật ký, Nhập liệu and Xuất bản live in the left menu only (no duplicate tiles).
