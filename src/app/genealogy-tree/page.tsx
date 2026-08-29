'use client';

import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import type { CustomNodeElementProps } from 'react-d3-tree';
import treeData from './new_treeData.json';
import { TreeControls } from '@/components/tree/TreeControls';
import type { FamilyMember } from '@/lib/tree/types';

const Tree = dynamic(() => import('react-d3-tree'), { ssr: false });

const familyTree = treeData as FamilyMember;

const INITIAL_ZOOM = 0.9;
const SCALE_EXTENT = { min: 0.3, max: 2.5 };

export default function GenealogyTree() {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [initialTranslate, setInitialTranslate] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const handleContainerRef = (containerRef: HTMLDivElement | null) => {
    if (containerRef && !dimensions) {
      const rect = containerRef.getBoundingClientRect();
      const centered = { x: rect.width / 2, y: rect.height / 6 };
      setTranslate(centered);
      setInitialTranslate(centered);
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

  function renderNode({ nodeDatum, toggleNode }: CustomNodeElementProps) {
    const hasChildren = Boolean(nodeDatum.children && nodeDatum.children.length > 0);
    const isCollapsed = nodeDatum.__rd3t.collapsed;

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
          style={{ strokeWidth: 1.5 }}
        />
        <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" className="fill-text text-sm">
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
    </div>
  );
}
