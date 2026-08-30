# Tree Lazy Member Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch per-member detail (birth/death/gender/notes/avatar/spouses) lazily per member instead of embedded in the whole-tree response, keeping the tree's LOD-detailed rendering and the member detail panel working with a loading/error state while that fetch is in flight.

**Architecture:** A `detailsById: Map<number, MemberDetail>` cache in `GenealogyTree`, populated by a single `ensureMemberDetail(id)` (deduplicated via a ref-held promise map) called both from an effect reacting to `detailSet` changes (LOD-driven prefetch) and from opening the detail panel (`openMemberDetail`, replacing `handleNodeClick`/`handleSelectChild`'s previous synchronous field reads). Existing mutation handlers additionally patch this cache via `patchMemberDetail` so the tree and panel reflect a save without a re-fetch.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest (existing setup).

**Spec:** `docs/superpowers/specs/2026-08-30-tree-lazy-detail-design.md`

**Depends on:** `genealogy-api`'s `2026-08-30-member-tree-skeleton.md` plan (this plan assumes `GET /api/members/tree` returns `{id, name, children}` and `GET /api/members/{id}` exists) — implement that one first.

## Global Constraints

- `findMembersByName`, `getReparentCandidates`, `getMemberAtPath` (`src/lib/tree/search.ts`) are not modified — they only ever needed `id`/`name`/`children`.
- No new e2e/browser test automation — pure logic gets a Vitest unit test; UI/interaction behavior is verified by running `npm run dev` and checking in a browser, per this plan's spec and the prior tree-lod plan's precedent.
- `npx tsc --noEmit` and `npm run build` must both pass after every task (the prior tree-lod plan's build-time prerender crash — see its Task 2 fix commit — is a reminder that `next build` catches things `tsc`/tests don't for this specific file).
- `npm run test` (Vitest) must pass after every task.

---

## File Structure

```
genealogy-web/
  src/
    lib/tree/
      types.ts               # modified: add MemberDetail (Task 1), trim FamilyMember (Task 2)
      detail-cache.ts          # new: idsNeedingDetail (Task 1)
      detail-cache.test.ts      # new (Task 1)
    app/genealogy-tree/
      page.tsx                   # modified (Task 2): detail cache, fetching, panel wiring
    components/tree/
      MemberDetailPanel.tsx        # modified (Task 2): loading/error props + gating
```

---

### Task 1: `MemberDetail` type + `idsNeedingDetail` (TDD)

**Files:**
- Modify: `src/lib/tree/types.ts`
- Create: `src/lib/tree/detail-cache.ts`, `src/lib/tree/detail-cache.test.ts`

**Interfaces:**
- Produces: `MemberDetail` type (`src/lib/tree/types.ts`) — `{id: number, birth_year: number | null, death_year: number | null, gender: Gender | null, notes: string | null, avatar_url: string | null, spouses: Spouse[]}`.
- Produces: `idsNeedingDetail(detailSet: Set<number>, cache: Map<number, MemberDetail>): number[]` (`src/lib/tree/detail-cache.ts`), imported by Task 2 as `import { idsNeedingDetail } from '@/lib/tree/detail-cache'`.

- [ ] **Step 1: Add the `MemberDetail` type**

In `src/lib/tree/types.ts`, add at the end of the file:

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

- [ ] **Step 2: Write the failing test**

Create `src/lib/tree/detail-cache.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { idsNeedingDetail } from './detail-cache';
import type { MemberDetail } from './types';

function detailFor(id: number): MemberDetail {
  return {
    id,
    birth_year: null,
    death_year: null,
    gender: null,
    notes: null,
    avatar_url: null,
    spouses: [],
  };
}

describe('idsNeedingDetail', () => {
  it('returns ids in the set that are not yet cached', () => {
    const cache = new Map([[1, detailFor(1)]]);
    expect(idsNeedingDetail(new Set([1, 2, 3]), cache)).toEqual([2, 3]);
  });

  it('returns an empty array when everything is already cached', () => {
    const cache = new Map([[1, detailFor(1)], [2, detailFor(2)]]);
    expect(idsNeedingDetail(new Set([1, 2]), cache)).toEqual([]);
  });

  it('returns every id when the cache is empty', () => {
    expect(idsNeedingDetail(new Set([5, 6]), new Map())).toEqual([5, 6]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test -- detail-cache`
Expected: FAIL — `Cannot find module './detail-cache'`.

- [ ] **Step 4: Implement `idsNeedingDetail`**

Create `src/lib/tree/detail-cache.ts`:

```ts
import type { MemberDetail } from './types';

export function idsNeedingDetail(detailSet: Set<number>, cache: Map<number, MemberDetail>): number[] {
  return [...detailSet].filter((id) => !cache.has(id));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- detail-cache`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed (this task only adds new, unused-elsewhere code, so nothing should break).

- [ ] **Step 7: Commit**

```bash
git add src/lib/tree/types.ts src/lib/tree/detail-cache.ts src/lib/tree/detail-cache.test.ts
git commit -m "feat: add MemberDetail type and idsNeedingDetail helper"
```

---

### Task 2: Lazy detail fetching, caching, and panel loading state

**Files:**
- Modify: `src/lib/tree/types.ts`, `src/app/genealogy-tree/page.tsx`, `src/components/tree/MemberDetailPanel.tsx`

**Interfaces:**
- Consumes: `MemberDetail`, `idsNeedingDetail` from Task 1.

- [ ] **Step 1: Trim `FamilyMember` to the skeleton shape**

In `src/lib/tree/types.ts`, change:

```ts
export type FamilyMember = {
  id?: number;
  name: string;
  birth_year?: number | null;
  death_year?: number | null;
  gender?: Gender | null;
  notes?: string | null;
  avatar_url?: string | null;
  spouses?: Spouse[];
  children?: FamilyMember[];
};
```

to:

```ts
export type FamilyMember = {
  id?: number;
  name: string;
  children?: FamilyMember[];
};
```

- [ ] **Step 2: Run the typecheck to see what breaks**

Run: `npx tsc --noEmit`
Expected: FAIL — errors in `src/app/genealogy-tree/page.tsx` about `birth_year`/`death_year`/`gender`/`notes`/`avatar_url`/`spouses` not existing on `MemberNodeData`/`FamilyMember`. The rest of this task fixes each one.

- [ ] **Step 3: Simplify `MemberNodeData` and imports in `page.tsx`**

In `src/app/genealogy-tree/page.tsx`, change:

```ts
import { computeDetailSet } from '@/lib/tree/lod';
import { getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import type { FamilyMember, Gender, Spouse } from '@/lib/tree/types';
```

to:

```ts
import { idsNeedingDetail } from '@/lib/tree/detail-cache';
import { computeDetailSet } from '@/lib/tree/lod';
import { getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import type { FamilyMember, Gender, MemberDetail, Spouse } from '@/lib/tree/types';
```

Change:

```ts
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
};

// The API's tree nodes carry fields that react-d3-tree's own RawNodeDatum/TreeNodeDatum
// types don't declare (they only know about `name`/`children`/`attributes`) - these
// survive at runtime since react-d3-tree doesn't strip unknown properties.
type MemberNodeData = TreeNodeDatum & {
  id: number;
  birth_year?: number | null;
  death_year?: number | null;
  gender?: Gender | null;
  notes?: string | null;
  avatar_url?: string | null;
  spouses?: Spouse[];
};
```

to:

```ts
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
```

- [ ] **Step 4: Add the detail cache, `ensureMemberDetail`, and `patchMemberDetail`**

Change:

```ts
  const [focalId, setFocalId] = useState<number | null>(null);
  const detailSet = useMemo(
    () =>
      familyTree ? computeDetailSet(familyTree, focalId ?? familyTree.id ?? -1, DETAIL_RADIUS) : new Set<number>(),
    [familyTree, focalId]
  );
  // react-d3-tree doesn't export a clean ref-typed public API; `generateTree`/`centerNode`
  // are real (non-private) instance methods used here the same way the library uses them
  // internally to center a clicked node. Verified against node_modules/react-d3-tree source.
  const treeRef = useRef<TreeInstanceHandle | null>(null);
```

to:

```ts
  const [focalId, setFocalId] = useState<number | null>(null);
  const detailSet = useMemo(
    () =>
      familyTree ? computeDetailSet(familyTree, focalId ?? familyTree.id ?? -1, DETAIL_RADIUS) : new Set<number>(),
    [familyTree, focalId]
  );
  const [detailsById, setDetailsById] = useState<Map<number, MemberDetail>>(new Map());
  // Tracks in-flight/completed fetch attempts (including failures, cached as a resolved
  // null) so the LOD-driven prefetch effect and a panel click never issue two requests for
  // the same id, and so a failed fetch doesn't silently retry itself.
  const detailFetches = useRef<Map<number, Promise<MemberDetail | null>>>(new Map());

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

  function patchMemberDetail(id: number, patch: Partial<Omit<MemberDetail, 'id'>>) {
    setDetailsById((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) ?? {
        id,
        birth_year: null,
        death_year: null,
        gender: null,
        notes: null,
        avatar_url: null,
        spouses: [],
      };
      next.set(id, { ...existing, ...patch });
      return next;
    });
  }

  useEffect(() => {
    idsNeedingDetail(detailSet, detailsById).forEach((id) => {
      void ensureMemberDetail(id);
    });
    // detailsById intentionally excluded: ensureMemberDetail's own ref-backed dedup already
    // prevents duplicate fetches, so this only needs to re-scan when detailSet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSet]);

  // react-d3-tree doesn't export a clean ref-typed public API; `generateTree`/`centerNode`
  // are real (non-private) instance methods used here the same way the library uses them
  // internally to center a clicked node. Verified against node_modules/react-d3-tree source.
  const treeRef = useRef<TreeInstanceHandle | null>(null);
```

- [ ] **Step 5: Replace `handleNodeClick`/`handleSelectChild` with `openMemberDetail`**

Change:

```ts
  function handleNodeClick(hierarchyPointNode: HierarchyPointNodeOf) {
    const ancestorPath = pathOfHierarchyNode(hierarchyPointNode);
    const data = hierarchyPointNode.data as MemberNodeData;
    const parentData = hierarchyPointNode.parent?.data as MemberNodeData | undefined;
    const childrenNames = data.children?.map((child) => child.name) ?? [];
    setSelectedMember({
      id: data.id,
      parentId: parentData ? parentData.id : null,
      name: data.name,
      generation: ancestorPath.length,
      ancestorPath,
      childrenNames,
      birthYear: data.birth_year ?? null,
      deathYear: data.death_year ?? null,
      gender: data.gender ?? null,
      notes: data.notes ?? null,
      avatarUrl: data.avatar_url ?? null,
      spouses: toPanelSpouses(data.spouses),
    });
  }

  function handleSelectChild(childName: string) {
    if (!selectedMember) return;
    const newPath = [...selectedMember.ancestorPath, childName];
    const member = getMemberAtPath(familyTree, newPath);
    if (!member || member.id === undefined) return;
    setSelectedMember({
      id: member.id,
      parentId: selectedMember.id,
      name: member.name,
      generation: newPath.length,
      ancestorPath: newPath,
      childrenNames: member.children?.map((child) => child.name) ?? [],
      birthYear: member.birth_year ?? null,
      deathYear: member.death_year ?? null,
      gender: member.gender ?? null,
      notes: member.notes ?? null,
      avatarUrl: member.avatar_url ?? null,
      spouses: toPanelSpouses(member.spouses),
    });
  }
```

to:

```ts
  async function openMemberDetail(
    id: number,
    parentId: number | null,
    name: string,
    ancestorPath: string[],
    childrenNames: string[]
  ) {
    setSelectedMember({
      id,
      parentId,
      name,
      generation: ancestorPath.length,
      ancestorPath,
      childrenNames,
      birthYear: null,
      deathYear: null,
      gender: null,
      notes: null,
      avatarUrl: null,
      spouses: [],
      isDetailLoading: true,
      detailLoadError: false,
    });
    const detail = await ensureMemberDetail(id);
    setSelectedMember((prev) => {
      if (!prev || prev.id !== id) return prev;
      if (!detail) return { ...prev, isDetailLoading: false, detailLoadError: true };
      return {
        ...prev,
        isDetailLoading: false,
        detailLoadError: false,
        birthYear: detail.birth_year,
        deathYear: detail.death_year,
        gender: detail.gender,
        notes: detail.notes,
        avatarUrl: detail.avatar_url,
        spouses: toPanelSpouses(detail.spouses),
      };
    });
  }

  function handleNodeClick(hierarchyPointNode: HierarchyPointNodeOf) {
    const ancestorPath = pathOfHierarchyNode(hierarchyPointNode);
    const data = hierarchyPointNode.data as MemberNodeData;
    const parentData = hierarchyPointNode.parent?.data as MemberNodeData | undefined;
    const childrenNames = data.children?.map((child) => child.name) ?? [];
    void openMemberDetail(data.id, parentData ? parentData.id : null, data.name, ancestorPath, childrenNames);
  }

  function handleSelectChild(childName: string) {
    if (!selectedMember) return;
    const newPath = [...selectedMember.ancestorPath, childName];
    const member = getMemberAtPath(familyTree, newPath);
    if (!member || member.id === undefined) return;
    void openMemberDetail(
      member.id,
      selectedMember.id,
      member.name,
      newPath,
      member.children?.map((child) => child.name) ?? []
    );
  }

  function handleRetryLoadDetail() {
    if (!selectedMember) return;
    detailFetches.current.delete(selectedMember.id);
    void openMemberDetail(
      selectedMember.id,
      selectedMember.parentId,
      selectedMember.name,
      selectedMember.ancestorPath,
      selectedMember.childrenNames
    );
  }
```

- [ ] **Step 6: Patch the cache from each mutation handler**

In `handleUpdateMember`, change:

```ts
      if (input.parentId !== selectedMember.parentId) {
        // Re-parenting changes this member's position in the tree, so ancestorPath and
        // generation would be stale if the panel stayed open - close it instead and let
        // onDataChanged()'s refetch reflect the new structure the next time it's opened.
        setSelectedMember(null);
        onDataChanged();
        return { ok: true };
      }
```

to:

```ts
      patchMemberDetail(selectedMember.id, {
        birth_year: input.birthYear,
        death_year: input.deathYear,
        gender: input.gender,
        notes: input.notes,
      });

      if (input.parentId !== selectedMember.parentId) {
        // Re-parenting changes this member's position in the tree, so ancestorPath and
        // generation would be stale if the panel stayed open - close it instead and let
        // onDataChanged()'s refetch reflect the new structure the next time it's opened.
        setSelectedMember(null);
        onDataChanged();
        return { ok: true };
      }
```

In `handleAddSpouse`, change:

```ts
      const body: Spouse = await response.json();
      setSelectedMember((prev) =>
        prev ? { ...prev, spouses: [...prev.spouses, ...toPanelSpouses([body])] } : prev
      );
      onDataChanged();
```

to:

```ts
      const body: Spouse = await response.json();
      setSelectedMember((prev) =>
        prev ? { ...prev, spouses: [...prev.spouses, ...toPanelSpouses([body])] } : prev
      );
      patchMemberDetail(selectedMember.id, {
        spouses: [...(detailsById.get(selectedMember.id)?.spouses ?? []), body],
      });
      onDataChanged();
```

In `handleUpdateSpouse`, change:

```ts
      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              spouses: prev.spouses.map((spouse) =>
                spouse.marriageId === marriageId
                  ? {
                      ...spouse,
                      name: input.name,
                      birthYear: input.birthYear,
                      deathYear: input.deathYear,
                      gender: input.gender,
                      notes: input.notes,
                      marriageYear: input.marriageYear,
                    }
                  : spouse
              ),
            }
          : prev
      );
      onDataChanged();
```

to:

```ts
      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              spouses: prev.spouses.map((spouse) =>
                spouse.marriageId === marriageId
                  ? {
                      ...spouse,
                      name: input.name,
                      birthYear: input.birthYear,
                      deathYear: input.deathYear,
                      gender: input.gender,
                      notes: input.notes,
                      marriageYear: input.marriageYear,
                    }
                  : spouse
              ),
            }
          : prev
      );
      patchMemberDetail(selectedMember.id, {
        spouses: (detailsById.get(selectedMember.id)?.spouses ?? []).map((spouse) =>
          spouse.marriage_id === marriageId
            ? {
                ...spouse,
                full_name: input.name,
                birth_year: input.birthYear,
                death_year: input.deathYear,
                gender: input.gender,
                notes: input.notes,
                marriage_year: input.marriageYear,
              }
            : spouse
        ),
      });
      onDataChanged();
```

In `handleDeleteSpouse`, change:

```ts
      setSelectedMember((prev) =>
        prev
          ? { ...prev, spouses: prev.spouses.filter((spouse) => spouse.spouseId !== spouseId) }
          : prev
      );
      onDataChanged();
```

to:

```ts
      setSelectedMember((prev) =>
        prev
          ? { ...prev, spouses: prev.spouses.filter((spouse) => spouse.spouseId !== spouseId) }
          : prev
      );
      patchMemberDetail(selectedMember.id, {
        spouses: (detailsById.get(selectedMember.id)?.spouses ?? []).filter(
          (spouse) => spouse.id !== spouseId
        ),
      });
      onDataChanged();
```

In `handleUploadAvatar`, change:

```ts
      const body: { avatar_url: string } = await response.json();
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: body.avatar_url } : prev));
      onDataChanged();
```

to:

```ts
      const body: { avatar_url: string } = await response.json();
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: body.avatar_url } : prev));
      patchMemberDetail(selectedMember.id, { avatar_url: body.avatar_url });
      onDataChanged();
```

In `handleDeleteAvatar`, change:

```ts
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      onDataChanged();
```

to:

```ts
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      patchMemberDetail(selectedMember.id, { avatar_url: null });
      onDataChanged();
```

- [ ] **Step 7: Read the avatar from the cache in `renderNode`**

Change:

```ts
    const data = nodeDatum as MemberNodeData;
    const avatarClipId = `avatar-clip-${data.id}`;
    const isDetailed = detailSet.has(data.id);
```

to:

```ts
    const data = nodeDatum as MemberNodeData;
    const avatarClipId = `avatar-clip-${data.id}`;
    const isDetailed = detailSet.has(data.id);
    const avatarUrl = detailsById.get(data.id)?.avatar_url ?? null;
```

Change:

```ts
        {isDetailed &&
          (data.avatar_url ? (
            <>
              <clipPath id={avatarClipId}>
                <circle cx={0} cy={-12} r={14} />
              </clipPath>
              <image
                href={data.avatar_url}
```

to:

```ts
        {isDetailed &&
          (avatarUrl ? (
            <>
              <clipPath id={avatarClipId}>
                <circle cx={0} cy={-12} r={14} />
              </clipPath>
              <image
                href={avatarUrl}
```

(The rest of that `<image>`/fallback-circle block is unchanged — only the `data.avatar_url` reads become `avatarUrl`.)

- [ ] **Step 8: Add loading/error props to `MemberDetailPanelProps` and wire the retry handler**

In `src/components/tree/MemberDetailPanel.tsx`, change:

```ts
export type MemberDetailPanelProps = {
  name: string;
  generation: number;
  ancestorPath: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  avatarUrl: string | null;
  parentId: number | null;
  parentOptions: ParentOption[];
  childMembers: MemberDetailPanelChild[];
  spouses: PanelSpouse[];
  onClose: () => void;
```

to:

```ts
export type MemberDetailPanelProps = {
  name: string;
  generation: number;
  ancestorPath: string[];
  birthYear: number | null;
  deathYear: number | null;
  gender: Gender | null;
  notes: string | null;
  avatarUrl: string | null;
  parentId: number | null;
  parentOptions: ParentOption[];
  childMembers: MemberDetailPanelChild[];
  spouses: PanelSpouse[];
  isDetailLoading: boolean;
  detailLoadError: boolean;
  onRetryLoadDetail: () => void;
  onClose: () => void;
```

Change the function's destructured parameters:

```ts
export function MemberDetailPanel({
  name,
  generation,
  ancestorPath,
  birthYear,
  deathYear,
  gender,
  notes,
  avatarUrl,
  parentId,
  parentOptions,
  childMembers,
  spouses,
  onClose,
```

to:

```ts
export function MemberDetailPanel({
  name,
  generation,
  ancestorPath,
  birthYear,
  deathYear,
  gender,
  notes,
  avatarUrl,
  parentId,
  parentOptions,
  childMembers,
  spouses,
  isDetailLoading,
  detailLoadError,
  onRetryLoadDetail,
  onClose,
```

- [ ] **Step 9: Gate the view-mode detail fields and edit entry point**

Change:

```tsx
      ) : (
        <div>
          <div className="flex items-center gap-x-3">
            <AvatarOrInitial src={avatarUrl} initial={name.charAt(0)} size={64} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-x-2">
                <h2 className="text-lg font-semibold text-default">{name}</h2>
                <button type="button" onClick={startEditing} className="whitespace-nowrap text-sm text-muted hover:text-default">
                  Sửa
                </button>
              </div>
              {lifespan && <p className="mt-1 text-sm text-muted">{lifespan}</p>}
              {gender && <p className="mt-1 text-sm text-muted">{GENDER_LABELS[gender]}</p>}
            </div>
          </div>
          {notes && <p className="mt-2 whitespace-pre-wrap text-sm text-default">{notes}</p>}
        </div>
      )}
```

to:

```tsx
      ) : (
        <div>
          <div className="flex items-center gap-x-3">
            <AvatarOrInitial src={avatarUrl} initial={name.charAt(0)} size={64} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-x-2">
                <h2 className="text-lg font-semibold text-default">{name}</h2>
                {!isDetailLoading && !detailLoadError && (
                  <button type="button" onClick={startEditing} className="whitespace-nowrap text-sm text-muted hover:text-default">
                    Sửa
                  </button>
                )}
              </div>
              {isDetailLoading && <p className="mt-1 text-sm text-muted">Đang tải chi tiết...</p>}
              {detailLoadError && (
                <p className="mt-1 text-sm text-danger">
                  Không thể tải chi tiết.{' '}
                  <button type="button" onClick={onRetryLoadDetail} className="underline">
                    Thử lại
                  </button>
                </p>
              )}
              {!isDetailLoading && !detailLoadError && lifespan && <p className="mt-1 text-sm text-muted">{lifespan}</p>}
              {!isDetailLoading && !detailLoadError && gender && <p className="mt-1 text-sm text-muted">{GENDER_LABELS[gender]}</p>}
            </div>
          </div>
          {!isDetailLoading && !detailLoadError && notes && <p className="mt-2 whitespace-pre-wrap text-sm text-default">{notes}</p>}
        </div>
      )}
```

- [ ] **Step 10: Gate the spouses section**

Change:

```tsx
      <div className="mt-6">
        <h3 className="text-sm font-medium text-default">Vợ/chồng ({spouses.length})</h3>
        {spouses.length > 0 && (
```

to:

```tsx
      <div className="mt-6">
        <h3 className="text-sm font-medium text-default">Vợ/chồng ({spouses.length})</h3>
        {isDetailLoading && <p className="mt-2 text-sm text-muted">Đang tải...</p>}
        {detailLoadError && <p className="mt-2 text-sm text-muted">Không thể tải.</p>}
        {!isDetailLoading && !detailLoadError && spouses.length > 0 && (
```

Change (closing the list, right before the add-spouse form):

```tsx
          </ul>
        )}
        <div className="mt-3 flex items-center gap-x-2">
          <input
            value={newSpouseName}
            onChange={(e) => setNewSpouseName(e.target.value)}
            placeholder="Tên vợ/chồng..."
            className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
          />
          <input
            type="number"
            value={newSpouseMarriageYear}
            onChange={(e) => setNewSpouseMarriageYear(e.target.value)}
            placeholder="Năm cưới"
            className="w-24 shrink-0 rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
          />
          <button type="button" onClick={handleAddSpouse} disabled={isSubmitting || !newSpouseName.trim()} className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50">
            Thêm
          </button>
        </div>
      </div>
```

to:

```tsx
          </ul>
        )}
        {!isDetailLoading && !detailLoadError && (
          <div className="mt-3 flex items-center gap-x-2">
            <input
              value={newSpouseName}
              onChange={(e) => setNewSpouseName(e.target.value)}
              placeholder="Tên vợ/chồng..."
              className="w-full rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
            />
            <input
              type="number"
              value={newSpouseMarriageYear}
              onChange={(e) => setNewSpouseMarriageYear(e.target.value)}
              placeholder="Năm cưới"
              className="w-24 shrink-0 rounded-lg border-default border bg-app px-2 py-1 text-sm text-default placeholder:text-muted focus:outline-none"
            />
            <button type="button" onClick={handleAddSpouse} disabled={isSubmitting || !newSpouseName.trim()} className="whitespace-nowrap text-sm accent-text hover:underline disabled:opacity-50">
              Thêm
            </button>
          </div>
        )}
      </div>
```

- [ ] **Step 11: Pass the new props from `page.tsx`**

Change:

```tsx
      {selectedMember && (
        <MemberDetailPanel
          name={selectedMember.name}
          generation={selectedMember.generation}
          ancestorPath={selectedMember.ancestorPath}
          birthYear={selectedMember.birthYear}
          deathYear={selectedMember.deathYear}
          gender={selectedMember.gender}
          notes={selectedMember.notes}
          avatarUrl={selectedMember.avatarUrl}
          parentId={selectedMember.parentId}
          parentOptions={getReparentCandidates(familyTree, selectedMember.id)}
          spouses={selectedMember.spouses}
          childMembers={selectedMember.childrenNames.map((childName) => ({
            name: childName,
            onSelect: () => handleSelectChild(childName),
          }))}
          onClose={() => setSelectedMember(null)}
```

to:

```tsx
      {selectedMember && (
        <MemberDetailPanel
          name={selectedMember.name}
          generation={selectedMember.generation}
          ancestorPath={selectedMember.ancestorPath}
          birthYear={selectedMember.birthYear}
          deathYear={selectedMember.deathYear}
          gender={selectedMember.gender}
          notes={selectedMember.notes}
          avatarUrl={selectedMember.avatarUrl}
          parentId={selectedMember.parentId}
          parentOptions={getReparentCandidates(familyTree, selectedMember.id)}
          spouses={selectedMember.spouses}
          isDetailLoading={selectedMember.isDetailLoading}
          detailLoadError={selectedMember.detailLoadError}
          onRetryLoadDetail={handleRetryLoadDetail}
          childMembers={selectedMember.childrenNames.map((childName) => ({
            name: childName,
            onSelect: () => handleSelectChild(childName),
          }))}
          onClose={() => setSelectedMember(null)}
```

- [ ] **Step 12: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 13: Run the test suite**

Run: `npm run test`
Expected: PASS, all existing tests plus Task 1's still green.

- [ ] **Step 14: Production build**

Run: `npm run build`
Expected: succeeds, including prerendering `/genealogy-tree` (see this plan's Global Constraints on why this specifically is checked).

- [ ] **Step 15: Manual verification in the browser**

Requires the paired `genealogy-api` plan already implemented and both dev servers running (`uv run uvicorn app.main:app --reload` in `genealogy-api`, `npm run dev` in `genealogy-web`).

Check, using the browser devtools network tab:
- On initial load, `GET /api/members/tree` response contains only `id`/`name`/`children` — no `birth_year`/`avatar_url`/etc.
- Only a handful of `GET /api/members/{id}` requests fire on load (one per member within the LOD radius of the root), not one per member in the whole tree.
- Clicking a name-only (out-of-radius) node opens the panel immediately with its name and children list, shows "Đang tải chi tiết...", then fills in birth/death/avatar/spouses shortly after — and the "Sửa" button and spouse-editing controls aren't clickable until that finishes.
- Editing a member's name/birth year and saving updates both the panel and (if that member is avatar-detailed in the tree) the tree node, without a second fetch to `/members/{id}` for that member.
- Stop the `genealogy-api` dev server, click a node whose detail isn't cached yet — panel shows the "Không thể tải chi tiết. Thử lại" error. Restart the API server, click "Thử lại" — detail loads normally.

- [ ] **Step 16: Commit**

```bash
git add src/lib/tree/types.ts src/app/genealogy-tree/page.tsx src/components/tree/MemberDetailPanel.tsx
git commit -m "feat: fetch member tree detail lazily per member instead of all at once"
```
