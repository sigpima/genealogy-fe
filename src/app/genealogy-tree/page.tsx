'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState } from 'react';
import type { CustomNodeElementProps } from 'react-d3-tree';
import treeData from './new_treeData.json';
import { MemberDetailPanel } from '@/components/tree/MemberDetailPanel';
import { TreeControls } from '@/components/tree/TreeControls';
import { getMemberAtPath } from '@/lib/tree/search';
import type { FamilyMember } from '@/lib/tree/types';

const Tree = dynamic(() => import('react-d3-tree'), { ssr: false });

const familyTree = treeData as FamilyMember;

export type FocusRequest = {
  path: string[];
  token: number;
};

type SelectedMember = {
  name: string;
  generation: number;
  ancestorPath: string[];
  childrenNames: string[];
};

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

export default function GenealogyTree({ focusRequest }: { focusRequest?: FocusRequest | null }) {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [initialTranslate, setInitialTranslate] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [highlightedName, setHighlightedName] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
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
    const timer = setTimeout(() => setHighlightedName(null), 2000);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  function handleNodeClick(hierarchyPointNode: HierarchyPointNodeOf) {
    const ancestorPath = pathOfHierarchyNode(hierarchyPointNode);
    const childrenNames = hierarchyPointNode.data.children?.map((child) => child.name) ?? [];
    setSelectedMember({
      name: hierarchyPointNode.data.name,
      generation: ancestorPath.length,
      ancestorPath,
      childrenNames,
    });
  }

  function handleSelectChild(childName: string) {
    if (!selectedMember) return;
    const newPath = [...selectedMember.ancestorPath, childName];
    const member = getMemberAtPath(familyTree, newPath);
    if (!member) return;
    setSelectedMember({
      name: member.name,
      generation: newPath.length,
      ancestorPath: newPath,
      childrenNames: member.children?.map((child) => child.name) ?? [],
    });
  }

  function renderNode({ nodeDatum, hierarchyPointNode, toggleNode }: CustomNodeElementProps) {
    const hasChildren = Boolean(nodeDatum.children && nodeDatum.children.length > 0);
    const isCollapsed = nodeDatum.__rd3t.collapsed;
    const isHighlighted = nodeDatum.name === highlightedName;

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
        <text
          x={0}
          y={0}
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
          childMembers={selectedMember.childrenNames.map((childName) => ({
            name: childName,
            onSelect: () => handleSelectChild(childName),
          }))}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
