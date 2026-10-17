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
tree (custom `TreeCanvas`: d3-hierarchy layout + d3-zoom pan/zoom) plus login/signup pages, both wired to the sibling
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
- The tree **opens collapsed to `DEFAULT_EXPANDED_GENERATIONS` (4)**; the
  generation chips (`GenerationFilterBar`) set "expanded down to Đời N" via
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
signup need to know which family they mean: **`/t/<slug>`** (`src/app/t/[slug]/route.ts`) sets the
`tree_slug` cookie (validated by `isValidTreeSlug`, `src/lib/auth/tree.ts`) and redirects to `/` with a
*relative* `Location` (behind a proxy the request's own origin is not the public one). The signup page
shows which family the visitor is joining, or asks for the family link when the API cannot tell
(`/api/site/info` answers 404 with several families and no cookie, and the form is hidden). Trees and
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
`foldText` (`src/lib/text.ts`) mirrors the API's `fold()`: the header search (`findMembersByName`, still client-side and instant)
now ignores diacritics, and its dropdown ends with a "Tìm nâng cao" link to **`/tim-kiem?q=…`** (`SearchView`: name, generation,
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

**`FormAction` (`src/components/FormAction.tsx`) must not receive a
`handleSubmit` prop when used inside a `<form onSubmit={...}>`** — its
button is `type="submit"`, so passing the same handler as `onClick` too
fires it twice per submit. `loginForm.tsx`/`signupForm.tsx` rely on the
form's `onSubmit` alone; follow that pattern for any new auth-style form.

**Forgot/reset password pages** (`/forgot-password`, `/reset-password`)
follow the same layout pattern as `/login`/`/signup` (an `AuthHeader` +
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
