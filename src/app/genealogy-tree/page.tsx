'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CustomNodeElementProps, TreeNodeDatum } from 'react-d3-tree';
import {
  MemberDetailPanel,
  type AvatarUploadResult,
  type MemberUpdateInput,
  type MutationResult,
  type PanelSpouse,
  type SpouseAddInput,
  type SpouseUpdateInput,
} from '@/components/tree/MemberDetailPanel';
import { TreeControls } from '@/components/tree/TreeControls';
import { computeDetailSet } from '@/lib/tree/lod';
import { getMemberAtPath, getReparentCandidates } from '@/lib/tree/search';
import type { FamilyMember, Gender, Spouse } from '@/lib/tree/types';

const Tree = dynamic(() => import('react-d3-tree'), { ssr: false });

export type FocusRequest = {
  path: string[];
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

// Derived from CustomNodeElementProps rather than imported directly from 'd3-hierarchy' -
// react-d3-tree bundles its own (older) @types/d3-hierarchy, and the two HierarchyPointNode
// types are structurally incompatible for TS even though they're the same shape at runtime.
type HierarchyPointNodeOf = CustomNodeElementProps['hierarchyPointNode'];

type TreeInstanceHandle = {
  generateTree: () => { nodes: HierarchyPointNodeOf[] };
  centerNode: (node: HierarchyPointNodeOf) => void;
};

function pathOfHierarchyNode(node: HierarchyPointNodeOf): string[] {
  return node
    .ancestors()
    .reverse()
    .map((ancestor) => ancestor.data.name);
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.3, max: 2.5 };
const DETAIL_RADIUS = 3;

export type GenealogyTreeProps = {
  familyTree: FamilyMember;
  focusRequest?: FocusRequest | null;
  onDataChanged: () => void;
};

export default function GenealogyTree({ familyTree, focusRequest, onDataChanged }: GenealogyTreeProps) {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [initialTranslate, setInitialTranslate] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
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

  const handleContainerRef = (containerRef: HTMLDivElement | null) => {
    if (containerRef && !dimensions) {
      const rect = containerRef.getBoundingClientRect();
      const centered = { x: rect.width / 2, y: rect.height / 6 };
      setTranslate(centered);
      setInitialTranslate(centered);
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

  useEffect(() => {
    if (!focusRequest || !treeRef.current) return;
    const { nodes } = treeRef.current.generateTree();
    const target = nodes.find((node) => arraysEqual(pathOfHierarchyNode(node), focusRequest.path));
    if (!target) return;
    treeRef.current.centerNode(target);
    setHighlightedName(target.data.name);
    setFocalId((target.data as MemberNodeData).id);
    const timer = setTimeout(() => setHighlightedName(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRequest]);

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
      onDataChanged();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Không thể kết nối tới máy chủ.' };
    }
  }

  function renderNode({ nodeDatum, hierarchyPointNode, toggleNode }: CustomNodeElementProps) {
    const hasChildren = Boolean(nodeDatum.children && nodeDatum.children.length > 0);
    const isCollapsed = nodeDatum.__rd3t.collapsed;
    const isHighlighted = nodeDatum.name === highlightedName;
    const data = nodeDatum as MemberNodeData;
    const avatarClipId = `avatar-clip-${data.id}`;
    const isDetailed = detailSet.has(data.id);

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
          onClick={() => handleNodeClick(hierarchyPointNode)}
        />
        {isDetailed &&
          (data.avatar_url ? (
            <>
              <clipPath id={avatarClipId}>
                <circle cx={0} cy={-12} r={14} />
              </clipPath>
              <image
                href={data.avatar_url}
                x={-14}
                y={-26}
                width={28}
                height={28}
                clipPath={`url(#${avatarClipId})`}
                preserveAspectRatio="xMidYMid slice"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(hierarchyPointNode)}
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
                onClick={() => handleNodeClick(hierarchyPointNode)}
              />
              <text
                x={0}
                y={-12}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-on-primary text-xs"
                style={{ pointerEvents: 'none' }}
              >
                {nodeDatum.name.charAt(0).toUpperCase()}
              </text>
            </>
          ))}
        <text
          x={0}
          y={18}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text text-sm"
          onClick={() => handleNodeClick(hierarchyPointNode)}
        >
          {nodeDatum.name}
        </text>
        {hasChildren && (
          <g
            transform="translate(85, -25)"
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation();
              setFocalId(data.id);
              toggleNode();
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
    <div ref={handleContainerRef} className="relative h-full w-full overflow-hidden bg-app">
      <Tree
        // @ts-expect-error react-d3-tree's exported type doesn't model its class instance ref through next/dynamic
        ref={treeRef}
        data={familyTree}
        dimensions={dimensions ?? undefined}
        renderCustomNodeElement={renderNode}
        nodeSize={{ x: 250, y: 150 }}
        translate={translate}
        zoomable
        zoom={zoom}
        scaleExtent={SCALE_EXTENT}
        orientation="vertical"
        collapsible
        separation={{ siblings: 0.8, nonSiblings: 1.5 }}
        pathFunc="step"
        draggable
        onUpdate={({ zoom: liveZoom, translate: liveTranslate }) => {
          setZoom(liveZoom);
          setTranslate(liveTranslate);
        }}
      />
      <TreeControls
        onZoomIn={() => setZoom((z) => Math.min(SCALE_EXTENT.max, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(SCALE_EXTENT.min, z / 1.2))}
        onReset={() => {
          setZoom(INITIAL_ZOOM);
          setTranslate(initialTranslate);
        }}
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
