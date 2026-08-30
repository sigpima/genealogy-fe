'use client';

import type { HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import { AnimatePresence, motion } from 'framer-motion';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { computeLayout, stepPath, type TreeNodeSize, type TreeSeparation } from '@/lib/tree/layout';
import { filterVisibleLinks, filterVisibleNodes, visibleRect } from '@/lib/tree/viewport';
import type { FamilyMember } from '@/lib/tree/types';

export type TreeCanvasProps = {
  familyTree: FamilyMember;
  collapsedIds: Set<number>;
  nodeSize: TreeNodeSize;
  separation: TreeSeparation;
  scaleExtent: { min: number; max: number };
  initialZoom: number;
  renderNode: (node: HierarchyPointNode<FamilyMember>) => React.ReactNode;
};

export type TreeCanvasHandle = {
  centerOnNode: (id: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};

const TreeCanvas = forwardRef<TreeCanvasHandle, TreeCanvasProps>(function TreeCanvas(
  { familyTree, collapsedIds, nodeSize, separation, scaleExtent, initialZoom, renderNode },
  ref
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: initialZoom });

  const handleContainerRef = (node: HTMLDivElement | null) => {
    if (node && !dimensions) {
      const rect = node.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

  useEffect(() => {
    if (!svgRef.current || !dimensions) return;
    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([scaleExtent.min, scaleExtent.max])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });
    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(svgRef.current);
    selection.call(zoomBehavior);
    const initial = zoomIdentity.translate(dimensions.width / 2, dimensions.height / 6).scale(initialZoom);
    selection.call(zoomBehavior.transform, initial);
    // dimensions is measured once on mount (see this plan's Global Constraints on why there's
    // no resize handling), so this effect intentionally only re-runs if it changes from null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]);

  const layout = useMemo(
    () => computeLayout(familyTree, collapsedIds, nodeSize, separation),
    [familyTree, collapsedIds, nodeSize, separation]
  );

  const { visibleNodes, visibleLinks } = useMemo(() => {
    if (!dimensions) return { visibleNodes: [], visibleLinks: [] };
    const rect = visibleRect(transform, dimensions.width, dimensions.height);
    return {
      visibleNodes: filterVisibleNodes(layout.nodes, rect),
      visibleLinks: filterVisibleLinks(layout.links, rect),
    };
  }, [layout, transform, dimensions]);

  useImperativeHandle(ref, () => ({
    centerOnNode(id: number) {
      if (!dimensions || !svgRef.current || !zoomBehaviorRef.current) return;
      const node = layout.nodes.find((n) => n.data.id === id);
      if (!node) return;
      const k = transform.k;
      const next = zoomIdentity
        .translate(dimensions.width / 2 - node.x * k, dimensions.height / 2 - node.y * k)
        .scale(k);
      select(svgRef.current).call(zoomBehaviorRef.current.transform, next);
    },
    zoomIn() {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 1.2);
    },
    zoomOut() {
      if (!svgRef.current || !zoomBehaviorRef.current) return;
      select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, 1 / 1.2);
    },
    resetView() {
      if (!dimensions || !svgRef.current || !zoomBehaviorRef.current) return;
      const initial = zoomIdentity.translate(dimensions.width / 2, dimensions.height / 6).scale(initialZoom);
      select(svgRef.current).call(zoomBehaviorRef.current.transform, initial);
    },
  }));

  return (
    <div ref={handleContainerRef} className="relative h-full w-full overflow-hidden bg-app">
      <svg ref={svgRef} className="h-full w-full">
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <AnimatePresence>
            {visibleLinks.map((link) => (
              <motion.path
                key={`${link.source.data.id}-${link.target.data.id}`}
                d={stepPath(link.source, link.target)}
                className="fill-none stroke-border"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            ))}
            {visibleNodes.map((node) => (
              <motion.g
                key={node.data.id}
                transform={`translate(${node.x},${node.y})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {renderNode(node)}
              </motion.g>
            ))}
          </AnimatePresence>
        </g>
      </svg>
    </div>
  );
});

export default TreeCanvas;
