# Heritage Tree Redesign — Design Spec

Date: 2026-10-17
Status: Approved by owner 2026-10-17 (real tree ~700 members, perf target 2,000)

## Intent

The family-tree page works but looks like a generic admin screen (white
rectangles with a name and a +/− button), and a big tree still lags. The
owner has a finished visual design (`/design/`: `heritage_tree/DESIGN.md`
plus two mockup screens, `screen.png` + `code.html` each) with a warm
"giấy dó / chu sa / vàng kim" look and a three-level zoom behaviour
(dot → compact card → detailed card). This project rebuilds the web
UI to match that design **using only the data the API already returns**,
and uses the design's zoom levels as the main fix for the lag.

Why: the tree is a family's heirloom; it should feel dignified and be
pleasant to explore at any size.

## Goals

1. Restyle the whole logged-in app (shell, tree canvas, member cards,
   controls, detail panel) to the Heritage Tree design.
2. Member cards render at three levels chosen by zoom (see "Zoom levels").
3. A tree of several thousand members pans and zooms smoothly, at any
   zoom level.
4. The tree opens collapsed to the first few generations instead of fully
   expanded.
5. Keep every existing capability working: search-and-center, expand/
   collapse, ancestor view, member panel (rename, birth/death year, gender,
   notes, avatar, add child, delete, reparent, spouse add/edit/delete),
   theme switching, auth pages.

## Non-goals

- No backend, schema, or API changes. Anything the design shows that the
  data does not have is left out (list below), not faked.
- No new pages. The design's sidebar entries Sử Ký Dòng Họ, Lăng Mộ & Nhà
  Thờ, Lịch Giỗ & Sự Kiện, Thống Kê & Phân Tích are not built and not shown
  as disabled links.
- Not built: "Xuất Phả Đồ", "Thêm Thành Viên" top-bar button, branch
  selector ("Nhánh: …"), user-profile chip, "Cây Ngang" and "Đinh & Duệ"
  views, panel "Mộ Phần" tab, "Tư liệu & bút tích" gallery, tên tự, chức
  vị, thứ bậc (Trưởng nam…), nơi ở, "Đinh trắng / Nữ duệ" statistics.
- Login / signup / forgot / reset pages are only re-themed (new fonts and
  colours), not redesigned.

## Anti-goals (failure even if it "works")

- Pretty but laggy: zoomed out on a 5,000-member tree must not stutter.
- Invented data: no placeholder titles, fake generations labels like
  "Khởi Tổ" unless derivable, fake portraits.
- Existing edit flows regress (they are the part of the app people rely on).
- Colours or text that fail contrast on the cream background.

## Constraints

- Stack stays: Next.js 15 App Router, React 19, Tailwind v4, d3-zoom /
  d3-hierarchy. See `CLAUDE.md` for the architecture notes and gotchas
  (same-origin `/api` proxy, silent refetch after mutations, functional
  `setSelectedMember` updates, theme CSS variables).
- Data available per member: skeleton from `GET /api/members/tree`
  (`id`, `name`, `children`) for **everyone**; `GET /api/members/{id}`
  (birth/death year, gender, notes, avatar, spouses) **one request per
  member**, there is no batch endpoint. Detail is currently prefetched for
  members within 3 hops of the focal member (`lod.ts`).
- Existing tests are pure-logic Vitest only; keep that, add tests for new
  pure logic. UI is verified in the browser.
- Vietnamese UI text; fonts must support the Vietnamese subset.

## Decisions (made with the owner)

- Scope: UI redesign on existing data only; documentation first, then build.
- Source of truth for look: `/design/heritage_tree/DESIGN.md` and the two
  screens in `/design/`. Where this spec and the design disagree, this
  spec wins (it already accounts for missing data).

## Design

### Visual system

Adopt the DESIGN.md tokens: surface / primary (chu sa `#8B2635`) /
secondary (vàng kim `#C59B27`) / tertiary (ngọc `#1B4D3E`) palettes,
Noto Serif for names and headings, Be Vietnam Pro for UI and metadata,
radii 4/8/12px, warm ambient shadows, translucent "kính ngà" floating
controls, 1.5px orthogonal connector lines `#8C7D70` with a round dot at
branch points, dot-grid paper canvas (`#F9F6F0` / `#E3DCD1`, 24–28px).
Icons are inline SVG (no emoji, no icon-font download).

Generation accent (from DESIGN.md): Đời 1–2 gold on deeper ivory; Đời 3–5
red; Đời 6+ indigo `#264653` / `#4A6B82`. Living vs deceased styling: a
member with a birth year and no death year is "Đang sống" (matches the
current "1950 – nay" convention); with a death year is deceased (muted
ink-grey portrait/accents); unknown otherwise (neutral).

### Zoom levels (thresholds are the design's)

| Zoom k | Level | Content |
|---|---|---|
| < 0.40 | Dot | One 16px circle in the generation-accent colour. Hover tooltip: name + "Đời N". |
| 0.40 – 0.80 | Compact 160×56 | Name (serif), "Đời N" badge, lifespan if its detail is loaded. |
| > 0.80 | Detailed 240×110 | Round portrait/initial with status border, name, "Đời N", lifespan, first spouse ("Phối: …", "+n" if more), child count. Fields whose detail has not loaded yet show a subtle skeleton, never a wrong value. |

Collapsed branches render as a small tag under the parent: "N hậu duệ"
(descendant count from the skeleton) instead of the current +/− circle;
clicking expands. The expand/collapse affordance stays on cards that have
children.

Layout spacing (see Open calls 5 and 8) is computed once for the detailed card (about 272px
horizontal slot, about 206px vertical slot, matching design's 32px sibling
and 96px generation gaps) and smaller levels sit centred in the same
slots. Layout must not change when zoom crosses a threshold.

### Shell and controls

- Top bar: clan name on the left, search (existing behaviour, new look),
  logout, theme switcher. Clan name = "Gia tộc " + the root member's first
  word (surname) — this is an assumption, see Open calls.
- Left sidebar: only "Cây Gia Phả" (active). Collapses to an icon bar on
  tablet; hidden on mobile.
- Generation filter bar (floating, top of canvas): chips "Đời I … Đời N"
  with member counts per generation from the skeleton, plus "+k đời" when
  there are more than fit. Clicking chip *N* expands the tree down to
  generation N and collapses deeper branches (also a quick way to reduce
  load); the active chip shows the current depth.
- Bottom-centre viewport control: zoom −, slider with percentage, zoom +,
  Reset, "Toàn cảnh" (fit the whole currently-expanded tree in view).
- Minimap (bottom-left, hidden on mobile): all expanded nodes as tiny
  dots drawn on one `<canvas>`, a chu-sa rectangle for the current view,
  drag to move the view.
- Footer status strip: total members, number of generations, current zoom %.
- Floating controls use the translucent-ivory look with backdrop blur.

### Member panel (restyle, same behaviour)

Right drawer 400px on desktop, overlay on tablet, bottom sheet 90vh on
mobile. Header: "Đời N" badge, serif name, portrait with status badge
("Đang sống" only when known), lifespan. Two tabs: "Tiểu sử" (notes under
"Hành trạng & công đức", edit mode) and "Hôn phối & con" (spouses, children
list, add child, add spouse). Delete, reparent, avatar upload/remove, ancestor
view stay where they are in the flow today; only presentation changes. All
existing handlers and their `selectedMember` update rules are untouched.

### Performance

Requirements (how is the builder's call, these are the behaviours):

- Default state: only the first 4 generations expanded; deeper branches
  collapsed. Search, "focus" requests and chip clicks must auto-expand the
  path to their target (today `centerOnNode` silently fails on a collapsed
  target).
- Dot level draws one element per member; no per-member `motion` wrapper
  or other JS-driven animation on nodes or links. Fades, if any, are CSS
  only and respect `prefers-reduced-motion`.
- Panning/momentum must not re-render every visible card on every frame:
  apply the pan transform to the DOM directly and update React state only
  when the visible set can have changed (for example, when the view moves
  past a margin, zoom crosses a level boundary, or layout/data changes).
- Cards are memoised by (id, level, relevant detail, highlight state).
- Visible-area margin should shrink from today's 1× screen on each side to
  about 0.5× (builder may tune).
- Detail fetching stays bounded (no request storm): see Open call 9
  (visible members at compact/detailed level only, concurrency-limited,
  nearest-first, existing dedupe); the dot level never triggers fetches.
- `SCALE_EXTENT.min` becomes dynamic, see Open call 8.
- Acceptance test data: the real tree has about 700 members; the owner
  wants headroom, so the target is a synthetic tree of ~2,000 members
  (dev-only fixture or generator, not shipped). Target: no sustained
  frames over ~33ms while panning at zoom 0.2, 0.6 and 1.2 on a typical
  laptop.

### Accessibility and responsiveness

Contrast at least 4.5:1 for text on cream and on the gold/red chips; visible
focus rings; icon-only buttons have `aria-label`; keyboard: search and
controls reachable, Enter/Space on a focused card opens the panel (only
visible cards are focusable); touch targets ≥ 44px on controls; layouts for
desktop ≥1280, tablet 768–1279, mobile <768 as described above.

### Themes

The existing theme system (CSS variables on `data-theme`, persisted
choice) stays. Add a fourth theme, **heritage**, carrying the DESIGN.md
palette, and make it the default. The three existing themes keep working
with the same components (the new tokens — secondary, tertiary, generation
accents, connector colour — get sensible values in each).

## Left to the builder

File/component structure, how the pan transform is applied, minimap
implementation details, exact skeleton visuals, tooltip implementation,
test additions for new pure helpers (generation counts, default-collapse
set, level-for-zoom, fit-to-view, expand-path-to-node), and updating
`CLAUDE.md` where it is now stale (it still describes `react-d3-tree`).

## Open calls I made (change any of them)

1. Clan name derived from the root member's surname.
2. Generation chips mean "show down to Đời N", not "highlight Đời N".
3. Dot colour is by generation tier, not by branch (Trưởng/Thứ is not in
   the data).
4. Heritage is added as a 4th theme and made the default, rather than
   replacing the other three.
5. Layout is fixed to the detailed-card size; no relayout on zoom tier.
6. Cây Ngang, Đinh & Duệ, and every sidebar entry except Cây Gia Phả are
   omitted entirely.
7. Fonts: Noto Serif + Be Vietnam Pro via `next/font`, replacing Inter.
8. **Whole-tree view.** Layout stays fixed (call 5), so a very wide tree
   cannot fit at a fixed zoom floor. The zoom floor is therefore dynamic:
   `min = min(0.15, scale needed to fit the expanded tree)`, and "Toàn
   cảnh" always fits the whole expanded tree, even if that means dots only.
   Because the tree opens at 4 generations, the normal fit is much smaller
   than the full tree.
9. **Lifespan / status on compact cards.** Detail is fetched for members
   that are visible at the compact or detailed level (not dot), plus the
   existing 3-hop focal set. Requests are concurrency-limited (about 6 at a
   time), nearest to the view centre first, deduped as today. Until a
   member's detail arrives, the card reserves the space and shows a
   skeleton, never an empty-looking or wrong value. Cost to know about: one
   API request per member who scrolls into view at those zoom levels.
10. **"Đang sống" cutoff.** A member is living only if they have a birth
    year, no death year, and were born within the last 100 years. A birth
    year older than that with no death year is "unknown": lifespan shows
    "1850 – ?" with neutral styling and no "Đang sống" badge. No birth year
    is also unknown.
11. **Chips vs manual expansion.** Clicking a chip resets all manual
    expand/collapse choices to "expanded down to Đời N". Search/focus
    auto-expansion persists until the next chip click. A chip shows as
    active only when the current expansion is exactly down to that
    generation; with an uneven manual state, no chip is highlighted.
12. **Existing theme choices.** Users who already picked a theme keep it
    (stored value wins). Heritage is the default only for users with no
    stored choice.
