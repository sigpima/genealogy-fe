'use client';

import type { HierarchyPointNode } from 'd3-hierarchy';
import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MemberDetailPanel,
  type AvatarUploadResult,
  type MemberUpdateInput,
  type MutationResult,
  type PanelSpouse,
  type SpouseAddInput,
  type SpouseUpdateInput,
} from '@/components/tree/MemberDetailPanel';
import type { TreeCanvasHandle } from '@/components/tree/TreeCanvas';
import { TreeControls } from '@/components/tree/TreeControls';
import { idsNeedingDetail } from '@/lib/tree/detail-cache';
import { computeDetailSet } from '@/lib/tree/lod';
import { getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import type { FamilyMember, Gender, MemberDetail, Spouse } from '@/lib/tree/types';

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
  spouses: PanelSpouse[];
  isDetailLoading: boolean;
  detailLoadError: boolean;
};

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

const NODE_SIZE = { x: 250, y: 150 };
const SEPARATION = { siblings: 0.8, nonSiblings: 1.5 };
const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.3, max: 2.5 };
const DETAIL_RADIUS = 3;

export type GenealogyTreeProps = {
  familyTree: FamilyMember;
  focusRequest?: FocusRequest | null;
  onDataChanged: () => void;
};

export default function GenealogyTree({ familyTree, focusRequest, onDataChanged }: GenealogyTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
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

  const canvasRef = useRef<TreeCanvasHandle | null>(null);

  useEffect(() => {
    if (!focusRequest || !canvasRef.current) return;
    canvasRef.current.centerOnNode(focusRequest.id);
    setHighlightedName(focusRequest.name);
    setFocalId(focusRequest.id);
    const timer = setTimeout(() => setHighlightedName(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRequest]);

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

  function handleNodeClick(node: HierarchyPointNode<FamilyMember>) {
    const ancestorPath = node
      .ancestors()
      .reverse()
      .map((ancestor) => ancestor.data.name);
    const childrenNames = node.data.children?.map((child) => child.name) ?? [];
    void openMemberDetail(
      node.data.id ?? -1,
      node.parent?.data.id ?? null,
      node.data.name,
      ancestorPath,
      childrenNames
    );
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
        }),
      });
      if (!response.ok) {
        if (response.status === 400) {
          return { ok: false, error: 'Không thể chuyển cha: sẽ tạo vòng lặp trong cây.' };
        }
        return { ok: false, error: 'Không thể lưu. Vui lòng thử lại.' };
      }

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
            }
          : prev
      );
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

  function renderNode(node: HierarchyPointNode<FamilyMember>) {
    const id = node.data.id ?? -1;
    const hasChildren = Boolean(node.data.children && node.data.children.length > 0);
    const isCollapsed = collapsedIds.has(id);
    const isHighlighted = node.data.name === highlightedName;
    const avatarClipId = `avatar-clip-${id}`;
    const isDetailed = detailSet.has(id);
    const avatarUrl = detailsById.get(id)?.avatar_url ?? null;

    return (
      <g>
        <rect
          width={200}
          height={70}
          x={-100}
          y={-35}
          rx={14}
          ry={14}
          className="fill-surface stroke-border"
          style={{
            strokeWidth: isHighlighted ? 3 : 1.5,
            stroke: isHighlighted ? 'var(--color-accent)' : undefined,
          }}
          onClick={() => handleNodeClick(node)}
        />
        {isDetailed &&
          (avatarUrl ? (
            <>
              <clipPath id={avatarClipId}>
                <circle cx={0} cy={-12} r={14} />
              </clipPath>
              <image
                href={avatarUrl}
                x={-14}
                y={-26}
                width={28}
                height={28}
                clipPath={`url(#${avatarClipId})`}
                preserveAspectRatio="xMidYMid slice"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node)}
              />
            </>
          ) : (
            <>
              <circle
                cx={0}
                cy={-12}
                r={14}
                className="fill-primary"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node)}
              />
              <text
                x={0}
                y={-12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-on-primary text-xs"
                style={{ pointerEvents: 'none' }}
              >
                {node.data.name.charAt(0).toUpperCase()}
              </text>
            </>
          ))}
        <text
          x={0}
          y={18}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text text-sm"
          onClick={() => handleNodeClick(node)}
        >
          {node.data.name}
        </text>
        {hasChildren && (
          <g
            transform="translate(85, -25)"
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
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
            }}
          >
            <circle r={10} className="fill-primary" />
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-on-primary text-xs"
              style={{ pointerEvents: 'none' }}
            >
              {isCollapsed ? '+' : '−'}
            </text>
          </g>
        )}
      </g>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-app">
      <TreeCanvas
        ref={canvasRef}
        familyTree={familyTree}
        collapsedIds={collapsedIds}
        nodeSize={NODE_SIZE}
        separation={SEPARATION}
        scaleExtent={SCALE_EXTENT}
        initialZoom={INITIAL_ZOOM}
        renderNode={renderNode}
      />
      <TreeControls
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onReset={() => canvasRef.current?.resetView()}
      />
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
