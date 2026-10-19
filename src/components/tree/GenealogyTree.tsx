'use client';

import type { HierarchyPointNode } from 'd3-hierarchy';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MemberDetailPanel, type PanelMe } from '@/components/tree/MemberDetailPanel';
import { BranchChips } from '@/components/tree/BranchChips';
import { GenerationFilterBar } from '@/components/tree/GenerationFilterBar';
import { MemberCard } from '@/components/tree/MemberCard';
import { StatusStrip } from '@/components/tree/StatusStrip';
import { UpcomingStrip } from '@/components/tree/UpcomingStrip';
import type { TreeCanvasHandle } from '@/components/tree/TreeCanvas';
import { ExportDialog } from '@/components/tree/ExportDialog';
import { ViewportControls } from '@/components/tree/ViewportControls';
import {
  DETAIL_RADIUS,
  INITIAL_ZOOM,
  NODE_SIZE,
  NODE_SIZE_HORIZONTAL,
  SCALE_EXTENT,
  SEPARATION,
} from '@/components/tree/genealogy-tree/constants';
import { loadingMember, withDetail, type SelectedMember } from '@/components/tree/genealogy-tree/selectedMember';
import { useMemberDetails } from '@/components/tree/genealogy-tree/useMemberDetails';
import { useMemberMutations } from '@/components/tree/genealogy-tree/useMemberMutations';
import { useOrientation } from '@/components/tree/genealogy-tree/useOrientation';
import { assignBranches, type Branch } from '@/lib/branches/branches';
import { collapsedIdsForDepth, expandPathTo } from '@/lib/tree/expansion';
import {
  deepestShownGeneration,
  defaultDepth,
  idsInSubtree,
  subtreeDepth,
} from '@/lib/tree/generationStepper';
import {
  descendantCount,
  totalMembers,
} from '@/lib/tree/generations';
import { computeDetailSet } from '@/lib/tree/lod';
import { lifespanLabel, memberStatus } from '@/lib/tree/member-status';
import type { ZoomLevel } from '@/lib/tree/zoom';
import { findAncestorChainById, getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

const TreeCanvas = dynamic(() => import('@/components/tree/TreeCanvas'), { ssr: false });

export type FocusRequest = {
  id: number;
  name: string;
  token: number;
};

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
  /** The signed-in account: which person it is (if linked) and whether an admin may link themself. */
  me?: PanelMe | null;
  /** Called after the account's link to a person changed (the session is read again). */
  onMeChanged?: () => void;
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
  me = null,
  onMeChanged,
}: GenealogyTreeProps) {
  // Opens collapsed to the first few generations; later refetches keep the user's own state.
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(() =>
    collapsedIdsForDepth(familyTree, defaultDepth(subtreeDepth(familyTree)))
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
  const [exporting, setExporting] = useState(false);
  const [orientation, toggleOrientation] = useOrientation();
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  const [focalId, setFocalId] = useState<number | null>(null);
  const detailSet = useMemo(
    () =>
      familyTree ? computeDetailSet(familyTree, focalId ?? familyTree.id ?? -1, DETAIL_RADIUS) : new Set<number>(),
    [familyTree, focalId]
  );
  const { detailsById, ensureMemberDetail, patchMemberDetail, refetchDetails, forgetFetch, handleVisibleChange, hasFailed } =
    useMemberDetails(detailSet, synthetic);

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

  /** "Xem riêng nhánh này": show only the descendants of one person (the same view mechanism as the ancestor view). */
  function handleViewBranch(memberId: number) {
    const chain = findAncestorChainById(familyTree, memberId);
    const node = chain?.[chain.length - 1];
    if (!node) return;
    setAncestorViewRootId(memberId);
    // A branch opens on its first four generations; what was collapsed inside it before is forgotten.
    const inside = idsInSubtree(node);
    const opening = collapsedIdsForDepth(node, defaultDepth(subtreeDepth(node)));
    setCollapsedIds((prev) => new Set([...[...prev].filter((id) => !inside.has(id)), ...opening]));
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
    setSelectedMember(loadingMember(id, parentId, name, ancestorPath, childrenNames));
    const detail = await ensureMemberDetail(id);
    setSelectedMember((prev) => (!prev || prev.id !== id ? prev : withDetail(prev, detail)));
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
    forgetFetch(selectedMember.id);
    void openMemberDetail(
      selectedMember.id,
      selectedMember.parentId,
      selectedMember.name,
      selectedMember.ancestorPath,
      selectedMember.childrenNames
    );
  }

  const {
    handleUpdateMember,
    handleAddChildMember,
    handleDeleteMember,
    handleAddSpouse,
    handleUpdateSpouse,
    handleDeleteSpouse,
    handleUploadAvatar,
    handleDeleteAvatar,
  } = useMemberMutations({
    selectedMember,
    setSelectedMember,
    setCollapsedIds,
    detailsById,
    patchMemberDetail,
    refetchDetails,
    onDataChanged,
  });

  function renderNode(node: HierarchyPointNode<FamilyMember>, level: ZoomLevel) {
    const id = node.data.id ?? -1;
    const detail = detailsById.get(id);
    const childCount = node.data.children?.length ?? 0;
    const isCollapsed = collapsedIds.has(id);
    const detailState = detail ? 'loaded' : synthetic || hasFailed(id) ? 'failed' : 'loading';
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

  const hasBranches = (branches?.length ?? 0) > 0;
  const youngestGeneration = useMemo(
    () => displayRootGeneration + subtreeDepth(displayRoot) - 1,
    [displayRoot, displayRootGeneration]
  );
  const shownDepth = useMemo(
    () => deepestShownGeneration(displayRoot, collapsedIds, displayRootGeneration),
    [displayRoot, collapsedIds, displayRootGeneration]
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-app">
      <TreeCanvas
        ref={setCanvasRef}
        familyTree={displayRoot}
        collapsedIds={collapsedIds}
        nodeSize={orientation === 'horizontal' ? NODE_SIZE_HORIZONTAL : NODE_SIZE}
        orientation={orientation}
        separation={SEPARATION}
        scaleExtent={SCALE_EXTENT}
        initialZoom={INITIAL_ZOOM}
        renderNode={renderNode}
        onVisibleChange={handleVisibleChange}
      />
      <GenerationFilterBar
        min={displayRootGeneration}
        max={youngestGeneration}
        value={shownDepth}
        onChange={(depth) => setCollapsedIds(collapsedIdsForDepth(familyTree, depth))}
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
      <ViewportControls
        handle={canvasHandle}
        onExport={synthetic ? undefined : () => setExporting(true)}
        orientation={orientation}
        onToggleOrientation={toggleOrientation}
      />
      {exporting && (
        <ExportDialog
          familyTree={familyTree}
          branches={branches ?? []}
          selected={selectedMember ? { id: selectedMember.id, name: selectedMember.name } : null}
          signedIn={signedIn ?? false}
          onClose={() => setExporting(false)}
        />
      )}
      <StatusStrip total={totalMembers(familyTree)} generations={subtreeDepth(familyTree)} handle={canvasHandle} />
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
          me={me}
          onMeChanged={onMeChanged}
          parentId={selectedMember.parentId}
          parentOptions={getReparentCandidates(familyTree, selectedMember.id)}
          motherOptions={selectedMember.motherOptions}
          spouses={selectedMember.spouses}
          isDetailLoading={selectedMember.isDetailLoading}
          detailLoadError={selectedMember.detailLoadError}
          onRetryLoadDetail={handleRetryLoadDetail}
          onViewBranch={() => handleViewBranch(selectedMember.id)}
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
