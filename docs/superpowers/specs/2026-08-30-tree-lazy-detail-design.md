# Tree Lazy Member Detail — Design Spec

Date: 2026-08-30
Status: Approved for implementation planning

## Context

`GenealogyTree` currently fetches the entire family tree once (`Home` in
`src/app/page.tsx` calls `GET /api/members/tree`), including every
member's `birth_year`/`death_year`/`gender`/`notes`/`avatar_url`/
`spouses` — even though, since `2026-08-30-tree-lod-design.md`, most of
those fields are only ever rendered for members within 3 hops of
wherever the user is currently focused. This is sub-project 2 of the
four listed in that spec's Context (the API side is
`genealogy-api`'s paired `2026-08-30-member-tree-skeleton-design.md`,
which this spec assumes is already implemented): `GET /api/members/tree`
now returns only `{id, name, children}`, and a new
`GET /api/members/{id}` returns everything else for one member.

This spec covers what changes on the `genealogy-web` side to consume
that split: fetching per-member detail lazily, caching it, and updating
the two places that used to read those fields straight off the
in-memory tree (`renderNode`'s avatar, and the member detail panel).

## Goals

- Tree node rendering (the LOD-detailed case from the prior spec) sources
  `avatar_url` from a lazily-populated cache instead of the tree data
  itself, fetching only for members currently in the detail set.
- Clicking a node (or a child in the detail panel) opens the detail panel
  immediately using data already known from the skeleton (name,
  generation, ancestor path, children), then fills in the rest
  (birth/death/gender/notes/avatar/spouses) once fetched, with a visible
  loading state and editing disabled until it resolves.
- A failed detail fetch is recoverable (a retry action), not a silent
  dead end and not a stuck spinner.
- `findMembersByName`, `getReparentCandidates`, `getMemberAtPath` (all in
  `src/lib/tree/search.ts`) keep working unchanged — they only ever
  needed `id`/`name`/`children`, which the skeleton still has in full.

## Non-goals

- Fetching tree *shape* (children) lazily — per this conversation's
  decision, the whole skeleton loads up front (cheap: just id/name/
  parent-child edges for every member). Only the heavy per-member fields
  are lazy. See the paired API spec's Non-goals for the same call.
- Evicting the detail cache — it only grows for the life of the page
  (matches this app's scale; see Design).
- Any visual change to the LOD radius/threshold logic itself
  (`computeDetailSet` from the prior spec is unchanged).

## Design

### Types (`src/lib/tree/types.ts`)

`FamilyMember` shrinks to the actual skeleton shape:

```ts
export type FamilyMember = {
  id?: number;
  name: string;
  children?: FamilyMember[];
};
```

Removing `birth_year`/`death_year`/`gender`/`notes`/`avatar_url`/
`spouses` from it is deliberate: every current reader of those fields on
a `FamilyMember`/tree-node value needs to change to read from the new
detail cache instead, and losing the fields is what makes the compiler
point at every one of those call sites. A new type is added for the
lazily-fetched shape:

```ts
export type MemberDetail = {
  id: number;
  birth_year: number | null;
  death_year: number | null;
  gender: Gender | null;
  notes: string | null;
  avatar_url: string | null;
  spouses: Spouse[];
};
```

### Detail cache (`src/app/genealogy-tree/page.tsx`)

`GenealogyTree` gains `const [detailsById, setDetailsById] =
useState<Map<number, MemberDetail>>(new Map())`, plus a
`useRef<Map<number, Promise<MemberDetail | null>>>` (`detailFetches`) that
tracks in-flight/completed fetch attempts so concurrent callers (the
background prefetch effect and a click) never issue two requests for the
same id. A single `ensureMemberDetail(id)` is the only thing that reads
or writes `detailFetches`:

```ts
function ensureMemberDetail(id: number): Promise<MemberDetail | null> {
  const existing = detailFetches.current.get(id);
  if (existing) return existing;
  const promise = fetch(`/api/members/${id}`, { credentials: 'include' })
    .then((res) => (res.ok ? (res.json() as Promise<MemberDetail>) : null))
    .then((detail) => {
      if (detail) setDetailsById((prev) => new Map(prev).set(id, detail));
      return detail;
    })
    .catch(() => null);
  detailFetches.current.set(id, promise);
  return promise;
}
```

A failed attempt is cached too (as a resolved `null`), so it doesn't
retry on its own — retrying is explicit (see the panel's retry action
below, which deletes the id from `detailFetches.current` before calling
`ensureMemberDetail` again).

A pure helper, `src/lib/tree/detail-cache.ts`:

```ts
export function idsNeedingDetail(detailSet: Set<number>, cache: Map<number, MemberDetail>): number[] {
  return [...detailSet].filter((id) => !cache.has(id));
}
```

An effect fires `ensureMemberDetail` for whatever `idsNeedingDetail`
returns whenever `detailSet` changes (same trigger points as the prior
spec: expand/collapse toggle, search-select):

```ts
useEffect(() => {
  idsNeedingDetail(detailSet, detailsById).forEach((id) => {
    void ensureMemberDetail(id);
  });
}, [detailSet]);
```

`renderNode` reads `detailsById.get(data.id)?.avatar_url ?? null` instead
of `data.avatar_url` for the LOD-detailed avatar/initial branch.

### Opening the detail panel

`handleNodeClick` and `handleSelectChild` both funnel into one
`openMemberDetail(id, parentId, name, ancestorPath, childrenNames)`:
it calls `setSelectedMember` immediately with everything known from the
skeleton and `isDetailLoading: true`, `detailLoadError: false`, and the
not-yet-known fields `null`/`[]`; then awaits `ensureMemberDetail(id)`
and patches the result in — guarded by `prev.id === id` so a fetch that
resolves after the user has already clicked a different node doesn't
clobber the panel that's now open for someone else. A `null` result sets
`detailLoadError: true` instead of filling in the detail fields.
`SelectedMember` gains `isDetailLoading: boolean` and
`detailLoadError: boolean`.

`MemberDetailPanel` gains `isDetailLoading` and `detailLoadError` props
plus `onRetryLoadDetail: () => void`. While loading, the birth/death/
gender/notes/spouses sections show a lightweight "Đang tải chi tiết..."
state and their edit forms (including the main "Lưu"/save action, since
it currently submits `birthYear`/`deathYear`/`gender`/`notes` from panel
state) are disabled — submitting before the real values arrive would
overwrite them with the temporary `null` placeholders. On
`detailLoadError`, that same area instead shows an error message with a
"Thử lại" button wired to `onRetryLoadDetail`, which (in `page.tsx`)
deletes the id from `detailFetches.current` and calls `openMemberDetail`
again with the panel's current identity fields.

### Keeping the cache in sync after mutations

Each existing mutation handler that already optimistically patches
`selectedMember` (`handleUpdateMember`, `handleAddSpouse`,
`handleUpdateSpouse`, `handleDeleteSpouse`, `handleUploadAvatar`,
`handleDeleteAvatar`) also patches `detailsById` for the same id via a
small helper:

```ts
function patchMemberDetail(id: number, patch: Partial<Omit<MemberDetail, 'id'>>) {
  setDetailsById((prev) => {
    const next = new Map(prev);
    const existing = next.get(id) ?? {
      id, birth_year: null, death_year: null, gender: null, notes: null, avatar_url: null, spouses: [],
    };
    next.set(id, { ...existing, ...patch });
    return next;
  });
}
```

This keeps the tree's avatar rendering and a later reopen of the panel
consistent with what was just saved, without a second round-trip.

## Testing plan

- `idsNeedingDetail`: unit tests (Vitest) — returns ids in the set not in
  the cache; returns `[]` when everything is already cached; returns
  everything when the cache is empty.
- Backend changes are covered by the paired API spec's testing plan.
- Manual verification (no e2e automation, consistent with the prior
  spec): run `npm run dev`, confirm the network tab shows per-member
  `GET /api/members/{id}` calls only for nodes within the LOD radius (not
  for the whole tree up front); click a name-only (out-of-radius) node
  and confirm the panel opens immediately with name/children and fills
  in birth/death/avatar/spouses shortly after; confirm editing is
  disabled during that load; simulate a failed fetch (e.g. stop the API
  mid-session) and confirm the retry button recovers once the API is
  back.

## File structure (new/changed)

```
genealogy-web/
  src/
    lib/tree/
      types.ts             # modified: trim FamilyMember, add MemberDetail
      detail-cache.ts       # new: idsNeedingDetail
      detail-cache.test.ts   # new
    app/genealogy-tree/
      page.tsx                # modified: detailsById cache, ensureMemberDetail,
                               #   openMemberDetail, patchMemberDetail, renderNode avatar source
    components/tree/
      MemberDetailPanel.tsx     # modified: isDetailLoading/detailLoadError/onRetryLoadDetail
```
