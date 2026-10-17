'use client';

import type { HierarchyPointNode } from 'd3-hierarchy';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MemberDetailPanel,
  type AvatarUploadResult,
  type MemberUpdateInput,
  type MutationResult,
  type PanelProfile,
  type PanelSpouse,
  type SpouseAddInput,
  type SpouseUpdateInput,
} from '@/components/tree/MemberDetailPanel';
import { BranchChips } from '@/components/tree/BranchChips';
import { GenerationFilterBar } from '@/components/tree/GenerationFilterBar';
import { MemberCard } from '@/components/tree/MemberCard';
import { StatusStrip } from '@/components/tree/StatusStrip';
import { UpcomingStrip } from '@/components/tree/UpcomingStrip';
import type { TreeCanvasHandle, VisibleChange } from '@/components/tree/TreeCanvas';
import { ViewportControls } from '@/components/tree/ViewportControls';
import { assignBranches, type Branch, type BranchRef } from '@/lib/branches/branches';
import { idsNeedingDetail } from '@/lib/tree/detail-cache';
import { pickIdsToFetch } from '@/lib/tree/detail-queue';
import { collapsedIdsForDepth, expandPathTo, expandedDepthOf } from '@/lib/tree/expansion';
import {
  DEFAULT_EXPANDED_GENERATIONS,
  descendantCount,
  generationCounts,
  totalMembers,
} from '@/lib/tree/generations';
import { computeDetailSet } from '@/lib/tree/lod';
import { lifespanLabel, memberStatus } from '@/lib/tree/member-status';
import type { ZoomLevel } from '@/lib/tree/zoom';
import { findAncestorChainById, getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import { profileToPayload, toPanelProfile } from '@/lib/tree/profile';
import { EMPTY_API_PROFILE } from '@/lib/tree/types';
import type { FamilyMember, Gender, MemberDetail, RestingPlace, Spouse } from '@/lib/tree/types';

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
  profile: PanelProfile;
  siblingRank: string | null;
  branch: BranchRef | null;
  restingPlace: RestingPlace | null;
  /** The father's recorded spouses: the choices for "Mẹ". */
  motherOptions: { id: number; name: string }[];
  spouses: PanelSpouse[];
  isDetailLoading: boolean;
  detailLoadError: boolean;
};

const EMPTY_PROFILE: PanelProfile = toPanelProfile(EMPTY_API_PROFILE);

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

// Slot sized for the detailed card (240x110): siblings 272px apart = card + 32px gap,
// generations 206px apart = card + 96px gap. Never changes with zoom level.
const NODE_SIZE = { x: 272, y: 206 };
const SEPARATION = { siblings: 1, nonSiblings: 1.25 };
const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.15, max: 2.5 };
const DETAIL_RADIUS = 3;

export type GenealogyTreeProps = {
  familyTree: FamilyMember;
  focusRequest?: FocusRequest | null;
  /** The family's branches (chi/phái); cards of branch members get a coloured strip. */
  branches?: Branch[];
  onDataChanged: () => void;
  /** Dev-only load-test mode: no per-member detail requests are made. */
  synthetic?: boolean;
  /** Only admins edit; members and guests get a read-only panel (the API enforces it too). */
  canEdit: boolean;
  /** Signed in but not an admin: the panel offers "Đề xuất chỉnh sửa". */
  canPropose?: boolean;
  /** Signed in at all: media and places are not shown to guests. */
  signedIn?: boolean;
};

export default function GenealogyTree({
  familyTree,
  focusRequest,
  branches,
  onDataChanged,
  synthetic = false,
  canEdit,
  canPropose,
  signedIn,
}: GenealogyTreeProps) {
  // Opens collapsed to the first few generations; later refetches keep the user's own state.
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() =>
    collapsedIdsForDepth(familyTree, DEFAULT_EXPANDED_GENERATIONS)
  );
  const [pendingCenter, setPendingCenter] = useState<{ id: number } | null>(null);
  const [ancestorViewRootId, setAncestorViewRootId] = useState<number | null>(null);
  const displayRoot = useMemo(() => {
    if (ancestorViewRootId === null) return familyTree;
    const chain = findAncestorChainById(familyTree, ancestorViewRootId);
    return chain ? chain[chain.length - 1] : familyTree;
  }, [familyTree, ancestorViewRootId]);
  const displayRootGeneration = useMemo(() => {
    if (displayRoot.id === undefined) return 1;
    return findAncestorChainById(familyTree, displayRoot.id)?.length ?? 1;
  }, [familyTree, displayRoot]);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
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
  const failedDetailIds = useRef<Set<number>>(new Set());
  const [, setFailedTick] = useState(0);
  const inflightDetails = useRef(0);
  const lastVisible = useRef<VisibleChange | null>(null);
  const pumpDetailFetches = useRef<() => void>(() => {});
  // Focal-radius members wanted by the LOD set; fetched through the same limiter as visible ones.
  const focalIds = useRef<number[]>([]);

  function ensureMemberDetail(id: number): Promise<MemberDetail | null> {
    const existing = detailFetches.current.get(id);
    if (existing) return existing;
    const promise = fetch(`/api/members/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<MemberDetail>) : null))
      .then((detail) => {
        if (detail) {
          setDetailsById((prev) => new Map(prev).set(id, detail));
        } else {
          failedDetailIds.current.add(id);
          setFailedTick((tick) => tick + 1);
        }
        return detail;
      })
      .catch(() => {
        failedDetailIds.current.add(id);
        setFailedTick((tick) => tick + 1);
        return null;
      });
    detailFetches.current.set(id, promise);
    return promise;
  }

  function patchMemberDetail(id: number, patch: Partial<Omit<MemberDetail, 'id'>>) {
    setDetailsById((prev) => {
      const next = new Map(prev);
      const existing: MemberDetail = next.get(id) ?? {
        id,
        birth_year: null,
        death_year: null,
        gender: null,
        notes: null,
        avatar_url: null,
        ...EMPTY_API_PROFILE,
        sibling_rank: null,
        spouses: [],
      };
      next.set(id, { ...existing, ...patch });
      return next;
    });
  }

  // Sibling ranks (Trưởng/Thứ/Út) depend on other members, so after an edit that can change them
  // (a year/gender change, adding, deleting or moving a member) re-request details. The old data
  // stays on screen until the fresh response replaces it.
  function refetchDetails(alsoMemberId?: number) {
    detailFetches.current.clear();
    failedDetailIds.current.clear();
    if (alsoMemberId !== undefined) void ensureMemberDetail(alsoMemberId);
    pumpDetailFetches.current();
  }

  pumpDetailFetches.current = () => {
    if (synthetic) return;
    const change = lastVisible.current;
    const center = change?.center ?? { x: 0, y: 0 };
    // Focal members sit at the centre (distance 0) so they go first; visible ones follow nearest-first.
    // The dot level never fetches visible members, only the focal set.
    const candidates = [
      ...focalIds.current.map((id) => ({ id, x: center.x, y: center.y })),
      ...(change && change.level !== 'dot' ? change.nodes : []),
    ];
    pickIdsToFetch(candidates, center, detailFetches.current, inflightDetails.current).forEach((id) => {
      inflightDetails.current += 1;
      void ensureMemberDetail(id).finally(() => {
        inflightDetails.current -= 1;
        pumpDetailFetches.current();
      });
    });
  };
  const handleVisibleChange = useCallback((change: VisibleChange) => {
    lastVisible.current = change;
    pumpDetailFetches.current();
  }, []);

  useEffect(() => {
    if (synthetic) return;
    focalIds.current = idsNeedingDetail(detailSet, detailsById);
    pumpDetailFetches.current();
    // detailsById intentionally excluded: the pump skips anything already requested, so this
    // only needs to re-scan when detailSet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSet]);

  useEffect(() => {
    if (!selectedMember) return;
    const fresh = detailsById.get(selectedMember.id);
    // A rank depends on other members and a resting place on the places list: both can change under an open panel.
    const place = fresh?.resting_place ?? null;
    if (fresh && (fresh.sibling_rank !== selectedMember.siblingRank || place?.id !== selectedMember.restingPlace?.id)) {
      const memberId = selectedMember.id;
      setSelectedMember((prev) =>
        prev && prev.id === memberId ? { ...prev, siblingRank: fresh.sibling_rank, restingPlace: place } : prev
      );
    }
  }, [detailsById, selectedMember]);

  const canvasRef = useRef<TreeCanvasHandle | null>(null);
  // Controls need to know when the (dynamically loaded) canvas handle appears or is replaced.
  const [canvasHandle, setCanvasHandle] = useState<TreeCanvasHandle | null>(null);
  const setCanvasRef = useCallback((handle: TreeCanvasHandle | null) => {
    canvasRef.current = handle;
    setCanvasHandle(handle);
  }, []);

  useEffect(() => {
    if (!focusRequest || !canvasRef.current) return;
    setAncestorViewRootId(null);
    setCollapsedIds((prev) => expandPathTo(familyTree, prev, focusRequest.id));
    setPendingCenter({ id: focusRequest.id });
    setHighlightedId(focusRequest.id);
    setFocalId(focusRequest.id);
    const timer = setTimeout(() => setHighlightedId(null), 2000);
    return () => clearTimeout(timer);
    // familyTree intentionally excluded: only a new focus request should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const branchByMember = useMemo(() => assignBranches(familyTree, branches ?? []), [familyTree, branches]);

  function focusOn(id: number) {
    setAncestorViewRootId(null);
    setCollapsedIds((prev) => expandPathTo(familyTree, prev, id));
    setPendingCenter({ id });
    setHighlightedId(id);
    setFocalId(id);
    window.setTimeout(() => setHighlightedId(null), 2000);
  }

  // Centre once the render that includes the expanded path (and the new layout) has committed.
  useEffect(() => {
    if (!pendingCenter) return;
    canvasRef.current?.centerOnNode(pendingCenter.id);
    setPendingCenter(null);
  }, [pendingCenter, collapsedIds, ancestorViewRootId]);

  function handleViewAncestors(memberId: number) {
    const chain = findAncestorChainById(familyTree, memberId);
    if (!chain) return;
    const ancestor = chain[Math.max(0, chain.length - 1 - 4)];
    if (ancestor.id === undefined) return;
    setAncestorViewRootId(ancestor.id);
    setCollapsedIds((prev) => expandPathTo(familyTree, prev, memberId));
    setFocalId(memberId);
    setSelectedMember(null);
    setPendingCenter({ id: memberId });
  }

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
      profile: EMPTY_PROFILE,
      siblingRank: null,
      branch: null,
      restingPlace: null,
      motherOptions: [],
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
        profile: toPanelProfile(detail),
        siblingRank: detail.sibling_rank,
        branch: detail.branch ?? null,
        restingPlace: detail.resting_place ?? null,
        spouses: toPanelSpouses(detail.spouses),
      };
    });
    if (detail && parentId !== null) {
      const father = await ensureMemberDetail(parentId);
      const options = (father?.spouses ?? []).map((spouse) => ({ id: spouse.id, name: spouse.full_name }));
      setSelectedMember((prev) => (prev && prev.id === id ? { ...prev, motherOptions: options } : prev));
    }
  }

  // Resolves the path from the real root (not the ancestor-view root) so the name-based
  // lookups in handleSelectChild keep working while the ancestor view is active.
  function handleSelectMember(id: number) {
    const chain = findAncestorChainById(familyTree, id);
    if (!chain) return;
    const member = chain[chain.length - 1];
    void openMemberDetail(
      id,
      chain[chain.length - 2]?.id ?? null,
      member.name,
      chain.map((ancestor) => ancestor.name),
      member.children?.map((child) => child.name) ?? []
    );
  }
  const selectMemberRef = useRef(handleSelectMember);
  selectMemberRef.current = handleSelectMember;
  const handleCardSelect = useCallback((id: number) => selectMemberRef.current(id), []);
  const handleCardToggle = useCallback((id: number) => {
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
  }, []);

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
    failedDetailIds.current.delete(selectedMember.id);
    void openMemberDetail(
      selectedMember.id,
      selectedMember.parentId,
      selectedMember.name,
      selectedMember.ancestorPath,
      selectedMember.childrenNames
    );
  }

  async function handleUpdateMember(input: MemberUpdateInput): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: input.name,
          parent_id: input.parentId,
          birth_year: input.birthYear,
          death_year: input.deathYear,
          gender: input.gender,
          notes: input.notes,
          ...profileToPayload(input),
        }),
      });
      if (!response.ok) {
        if (response.status === 400) {
          return { ok: false, error: 'Không thể lưu: cha/mẹ không hợp lệ (vòng lặp trong cây, hoặc mẹ không phải vợ của cha).' };
        }
        if (response.status === 422) {
          return { ok: false, error: 'Dữ liệu chưa hợp lệ: kiểm tra ngày tháng, điện thoại, email.' };
        }
        return { ok: false, error: 'Không thể lưu. Vui lòng thử lại.' };
      }

      patchMemberDetail(selectedMember.id, {
        birth_year: input.birthYear,
        death_year: input.deathYear,
        gender: input.gender,
        notes: input.notes,
        ...profileToPayload(input),
      });

      if (input.parentId !== selectedMember.parentId) {
        // Re-parenting changes this member's position in the tree, so ancestorPath and
        // generation would be stale if the panel stayed open - close it instead and let
        // onDataChanged()'s refetch reflect the new structure the next time it's opened.
        setSelectedMember(null);
        refetchDetails();
        onDataChanged();
        return { ok: true };
      }

      // ancestorPath's last entry is this member's own (old) name - update it too, or
      // handleSelectChild's name-based path lookup would silently fail for any child
      // navigated to after a rename.
      const newAncestorPath = [...selectedMember.ancestorPath.slice(0, -1), input.name];
      setSelectedMember((prev) =>
        prev
          ? {
              ...prev,
              name: input.name,
              ancestorPath: newAncestorPath,
              birthYear: input.birthYear,
              deathYear: input.deathYear,
              gender: input.gender,
              notes: input.notes,
              profile: toPanelProfile(profileToPayload(input)),
            }
          : prev
      );
      refetchDetails(selectedMember.id);
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleAddChildMember(childName: string): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: childName, parent_id: selectedMember.id }),
      });
      if (!response.ok) return { ok: false, error: 'Không thể thêm. Vui lòng thử lại.' };
      setSelectedMember((prev) =>
        prev ? { ...prev, childrenNames: [...prev.childrenNames, childName] } : prev
      );
      const parentId = selectedMember.id;
      setCollapsedIds((prev) => {
        if (!prev.has(parentId)) return prev;
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
      refetchDetails(selectedMember.id);
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleDeleteMember(): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.status === 409) {
        return { ok: false, error: 'Không thể xoá vì còn con. Hãy xoá hoặc chuyển con trước.' };
      }
      if (!response.ok) return { ok: false, error: 'Không thể xoá. Vui lòng thử lại.' };
      setSelectedMember(null);
      refetchDetails();
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleAddSpouse(input: SpouseAddInput): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}/marriages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spouse_full_name: input.name, marriage_year: input.marriageYear }),
      });
      if (!response.ok) return { ok: false, error: 'Không thể thêm. Vui lòng thử lại.' };
      const body: Spouse = await response.json();
      setSelectedMember((prev) =>
        prev ? { ...prev, spouses: [...prev.spouses, ...toPanelSpouses([body])] } : prev
      );
      patchMemberDetail(selectedMember.id, {
        spouses: [...(detailsById.get(selectedMember.id)?.spouses ?? []), body],
      });
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleUpdateSpouse(
    marriageId: number,
    input: SpouseUpdateInput
  ): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/marriages/${marriageId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spouse_full_name: input.name,
          spouse_birth_year: input.birthYear,
          spouse_death_year: input.deathYear,
          spouse_gender: input.gender,
          spouse_notes: input.notes,
          marriage_year: input.marriageYear,
        }),
      });
      if (!response.ok) return { ok: false, error: 'Không thể lưu. Vui lòng thử lại.' };
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
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleDeleteSpouse(spouseId: number): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${spouseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) return { ok: false, error: 'Không thể xoá. Vui lòng thử lại.' };
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
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleUploadAvatar(file: File): Promise<AvatarUploadResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/members/${selectedMember.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) return { ok: false, error: 'Không thể tải ảnh lên. Vui lòng thử lại.' };
      const body: { avatar_url: string } = await response.json();
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: body.avatar_url } : prev));
      patchMemberDetail(selectedMember.id, { avatar_url: body.avatar_url });
      onDataChanged();
      return { ok: true, avatarUrl: body.avatar_url };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  async function handleDeleteAvatar(): Promise<MutationResult> {
    if (!selectedMember) return { ok: false, error: 'Không tìm thấy thành viên.' };
    try {
      const response = await fetch(`/api/members/${selectedMember.id}/avatar`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) return { ok: false, error: 'Không thể xoá ảnh. Vui lòng thử lại.' };
      setSelectedMember((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      patchMemberDetail(selectedMember.id, { avatar_url: null });
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  function renderNode(node: HierarchyPointNode<FamilyMember>, level: ZoomLevel) {
    const id = node.data.id ?? -1;
    const detail = detailsById.get(id);
    const childCount = node.data.children?.length ?? 0;
    const isCollapsed = collapsedIds.has(id);
    const detailState = detail ? 'loaded' : synthetic || failedDetailIds.current.has(id) ? 'failed' : 'loading';
    const birthYear = detail?.birth_year ?? null;
    const deathYear = detail?.death_year ?? null;
    const spouses = detail?.spouses ?? [];
    const spouseLabel =
      spouses.length === 0 ? null : spouses[0].full_name + (spouses.length > 1 ? ` +${spouses.length - 1}` : '');

    return (
      <MemberCard
        id={id}
        name={node.data.name}
        generation={node.depth + displayRootGeneration}
        level={level}
        status={memberStatus(birthYear, deathYear)}
        lifespan={lifespanLabel(birthYear, deathYear)}
        detailState={detailState}
        avatarUrl={detail?.avatar_url ?? null}
        branchColor={branchByMember.get(id)?.color ?? null}
        branchName={branchByMember.get(id)?.name ?? null}
        spouseLabel={spouseLabel}
        childCount={childCount}
        hasChildren={childCount > 0}
        isCollapsed={isCollapsed}
        hiddenDescendants={isCollapsed ? descendantCount(node.data) : 0}
        isHighlighted={id === highlightedId}
        rank={detail?.sibling_rank ?? null}
        isSelected={selectedMember?.id === id}
        onSelect={handleCardSelect}
        onToggle={handleCardToggle}
      />
    );
  }

  const counts = useMemo(() => generationCounts(familyTree), [familyTree]);
  const hasBranches = (branches?.length ?? 0) > 0;
  const activeDepth = useMemo(() => expandedDepthOf(familyTree, collapsedIds), [familyTree, collapsedIds]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-app">
      <TreeCanvas
        ref={setCanvasRef}
        familyTree={displayRoot}
        collapsedIds={collapsedIds}
        nodeSize={NODE_SIZE}
        separation={SEPARATION}
        scaleExtent={SCALE_EXTENT}
        initialZoom={INITIAL_ZOOM}
        renderNode={renderNode}
        onVisibleChange={handleVisibleChange}
      />
      <GenerationFilterBar
        counts={counts}
        activeDepth={activeDepth}
        onSelectDepth={(depth) => setCollapsedIds(collapsedIdsForDepth(familyTree, depth))}
      />
      {hasBranches && <BranchChips branches={branches ?? []} onSelect={(branch) => focusOn(branch.root_member_id)} />}
      {ancestorViewRootId !== null && (
        <button
          type="button"
          onClick={() => setAncestorViewRootId(null)}
          className={`shadow-float absolute left-4 ${hasBranches ? 'top-[7.5rem]' : 'top-20'} z-30 min-h-11 rounded-lg border-default border bg-surface px-3 text-sm text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]`}
        >
          Xem toàn bộ cây gia phả
        </button>
      )}
      {!selectedMember && !synthetic && <UpcomingStrip />}
      <ViewportControls handle={canvasHandle} />
      <StatusStrip total={totalMembers(familyTree)} generations={counts.length} handle={canvasHandle} />
      {selectedMember && (
        <MemberDetailPanel
          key={selectedMember.id}
          memberId={selectedMember.id}
          canEdit={canEdit}
          canPropose={canPropose}
          name={selectedMember.name}
          generation={selectedMember.generation}
          ancestorPath={selectedMember.ancestorPath}
          birthYear={selectedMember.birthYear}
          deathYear={selectedMember.deathYear}
          gender={selectedMember.gender}
          notes={selectedMember.notes}
          avatarUrl={selectedMember.avatarUrl}
          profile={selectedMember.profile}
          siblingRank={selectedMember.siblingRank}
          branch={selectedMember.branch}
          restingPlace={selectedMember.restingPlace}
          signedIn={signedIn}
          parentId={selectedMember.parentId}
          parentOptions={getReparentCandidates(familyTree, selectedMember.id)}
          motherOptions={selectedMember.motherOptions}
          spouses={selectedMember.spouses}
          isDetailLoading={selectedMember.isDetailLoading}
          detailLoadError={selectedMember.detailLoadError}
          onRetryLoadDetail={handleRetryLoadDetail}
          onViewAncestors={() => handleViewAncestors(selectedMember.id)}
          childMembers={selectedMember.childrenNames.map((childName) => ({
            name: childName,
            onSelect: () => handleSelectChild(childName),
          }))}
          onClose={() => setSelectedMember(null)}
          onUpdate={handleUpdateMember}
          onAddChild={handleAddChildMember}
          onDelete={handleDeleteMember}
          onAddSpouse={handleAddSpouse}
          onUpdateSpouse={handleUpdateSpouse}
          onDeleteSpouse={handleDeleteSpouse}
          onUploadAvatar={handleUploadAvatar}
          onDeleteAvatar={handleDeleteAvatar}
        />
      )}
    </div>
  );
}
