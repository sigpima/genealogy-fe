'use client';

import type { HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { computeLayout, slotSize, stepPath, type Orientation, type TreeNodeSize, type TreeSeparation } from '@/lib/tree/layout';
import { computeVelocity, isMomentumDone, nextMomentumStep, type Sample } from '@/lib/tree/momentum';
import {
  VISIBLE_MARGIN,
  filterVisibleLinks,
  filterVisibleNodes,
  needsRecommit,
  visibleRect,
  type Committed,
  type Transform,
} from '@/lib/tree/viewport';
import {
  boundsOf,
  clampZoom,
  fitTransform,
  minZoomFor,
  padBounds,
  zoomLevelFor,
  type Bounds,
  type ViewState,
  type ZoomLevel,
} from '@/lib/tree/zoom';
import type { FamilyMember } from '@/lib/tree/types';
import { cssRadius } from './svg-style';
import { Minimap } from './Minimap';

export type { ViewState } from '@/lib/tree/zoom';

export type VisibleChange = {
  nodes: { id: number; x: number; y: number }[];
  level: ZoomLevel;
  center: { x: number; y: number };
};

export type TreeCanvasProps = {
  familyTree: FamilyMember;
  collapsedIds: Set<number>;
  /** (lateral, depth) distances; see `slotSize`. */
  nodeSize: TreeNodeSize;
  separation: TreeSeparation;
  orientation?: Orientation;
  /** `min` is the floor; the effective minimum zoom drops lower when needed to fit the whole tree. */
  scaleExtent: { min: number; max: number };
  initialZoom: number;
  renderNode: (node: HierarchyPointNode<FamilyMember>, level: ZoomLevel) => React.ReactNode;
  onVisibleChange?: (change: VisibleChange) => void;
};

export type TreeCanvasHandle = {
  centerOnNode: (id: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitToView: () => void;
  setZoom: (k: number) => void;
  subscribe: (listener: (view: ViewState) => void) => () => void;
};

const CENTER_MIN_ZOOM = 0.5;

/** Where the root sits when the view is (re)set: top middle for rows of generations, left middle for columns. */
function startOffset(size: { width: number; height: number }, orientation: Orientation): [number, number] {
  return orientation === 'horizontal' ? [size.width / 6, size.height / 2] : [size.width / 2, size.height / 6];
}
// Keeps "Toàn cảnh" clear of the floating generation bar (top) and zoom bar / minimap (bottom).
const FIT_PADDING = { top: 96, right: 48, bottom: 112, left: 48 };

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const TreeCanvas = forwardRef<TreeCanvasHandle, TreeCanvasProps>(function TreeCanvas(
  { familyTree, collapsedIds, nodeSize, separation, orientation = 'vertical', scaleExtent, initialZoom, renderNode, onVisibleChange },
  ref
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const dimensionsRef = useRef(dimensions);
  dimensionsRef.current = dimensions;
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;
  const slot = useMemo(() => slotSize(nodeSize, orientation), [nodeSize, orientation]);

  // The live pan/zoom lives in a ref and is written straight to the DOM; React state (`committed`)
  // only changes when the set of visible nodes can change (see needsRecommit).
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: initialZoom });
  const [committed, setCommitted] = useState<Committed | null>(null);
  const committedRef = useRef<Committed | null>(null);
  const listenersRef = useRef(new Set<(view: ViewState) => void>());
  const minZoomRef = useRef(scaleExtent.min);
  const maxZoomRef = useRef(scaleExtent.max);
  maxZoomRef.current = scaleExtent.max;

  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setDimensions((prev) =>
        prev && Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1
          ? prev
          : { width: rect.width, height: rect.height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const notify = useCallback(() => {
    if (listenersRef.current.size === 0) return;
    const view: ViewState = { ...transformRef.current, minZoom: minZoomRef.current, maxZoom: maxZoomRef.current };
    listenersRef.current.forEach((listener) => listener(view));
  }, []);

  const lastInvKRef = useRef<number | null>(null);
  const lastSampleRef = useRef<Sample | null>(null);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const momentumFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!svgRef.current || !dimensions) return;

    function runMomentum() {
      if (prefersReducedMotion()) return;
      if (isMomentumDone(velocityRef.current.vx, velocityRef.current.vy)) return;
      let lastFrameTime = performance.now();
      const step = () => {
        const now = performance.now();
        const dt = now - lastFrameTime;
        lastFrameTime = now;
        const { vx, vy } = velocityRef.current;
        if (!svgRef.current || !zoomBehaviorRef.current || isMomentumDone(vx, vy)) {
          momentumFrameRef.current = null;
          return;
        }
        select(svgRef.current).call(
          zoomBehaviorRef.current.translateBy,
          (vx * dt) / transformRef.current.k,
          (vy * dt) / transformRef.current.k
        );
        velocityRef.current = nextMomentumStep(vx, vy);
        momentumFrameRef.current = requestAnimationFrame(step);
      };
      momentumFrameRef.current = requestAnimationFrame(step);
    }

    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoomRef.current, scaleExtent.max])
      .on('start', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (momentumFrameRef.current !== null) {
          cancelAnimationFrame(momentumFrameRef.current);
          momentumFrameRef.current = null;
        }
        lastSampleRef.current = { x: event.transform.x, y: event.transform.y, t: performance.now() };
        velocityRef.current = { vx: 0, vy: 0 };
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const t: Transform = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
        transformRef.current = t;
        const content = contentRef.current;
        content?.setAttribute('transform', `translate(${t.x},${t.y}) scale(${t.k})`);
        // Lets dots and junctions keep a constant on-screen size via CSS (no React re-render).
        if (lastInvKRef.current !== t.k) {
          lastInvKRef.current = t.k;
          content?.style.setProperty('--inv-k', String(1 / t.k));
        }
        notify();
        const dims = dimensionsRef.current;
        if (dims && needsRecommit(committedRef.current, t, dims.width, dims.height)) {
          const next: Committed = {
            rect: visibleRect(t, dims.width, dims.height, VISIBLE_MARGIN),
            level: zoomLevelFor(t.k),
          };
          committedRef.current = next;
          setCommitted(next);
        }
        const sourceType = (event.sourceEvent as Event | undefined)?.type;
        if (sourceType === 'mousemove' || sourceType === 'touchmove') {
          const sample: Sample = { x: t.x, y: t.y, t: performance.now() };
          if (lastSampleRef.current) {
            velocityRef.current = computeVelocity(lastSampleRef.current, sample);
          }
          lastSampleRef.current = sample;
        }
      })
      .on('end', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const sourceType = (event.sourceEvent as Event | undefined)?.type;
        if (sourceType !== 'mouseup' && sourceType !== 'touchend') return;
        runMomentum();
      });
    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(svgRef.current);
    selection.call(zoomBehavior);
    const initial = zoomIdentity.translate(...startOffset(dimensions, orientationRef.current)).scale(initialZoom);
    selection.call(zoomBehavior.transform, initial);
    // Runs once, when the container is first measured (later resizes are handled by the effects
    // below). scaleExtent is kept in sync by the layout-bounds effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions !== null]);

  // After a resize the committed (culling) rect must be recomputed for the new viewport size.
  useEffect(() => {
    if (!dimensions || !zoomBehaviorRef.current) return;
    const t = transformRef.current;
    const next: Committed = {
      rect: visibleRect(t, dimensions.width, dimensions.height, VISIBLE_MARGIN),
      level: zoomLevelFor(t.k),
    };
    committedRef.current = next;
    setCommitted(next);
  }, [dimensions]);

  const layout = useMemo(
    () => computeLayout(familyTree, collapsedIds, nodeSize, separation, orientation),
    [familyTree, collapsedIds, nodeSize, separation, orientation]
  );

  const bounds: Bounds = useMemo(() => {
    const raw = boundsOf(layout.nodes);
    return padBounds(raw ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }, slot.x / 2, slot.y / 2);
  }, [layout, slot]);

  // The zoom floor drops as far as needed for the whole expanded tree to fit on screen.
  useEffect(() => {
    if (!dimensions) return;
    const fitK = fitTransform(bounds, dimensions.width, dimensions.height, FIT_PADDING).k;
    minZoomRef.current = minZoomFor(fitK, scaleExtent.min);
    zoomBehaviorRef.current?.scaleExtent([minZoomRef.current, scaleExtent.max]);
    // d3 only clamps on the next gesture, so pull a now-out-of-range zoom back in immediately.
    const k = transformRef.current.k;
    const clamped = clampZoom(k, minZoomRef.current, scaleExtent.max);
    if (clamped !== k && svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).call(zoomBehaviorRef.current.scaleTo, clamped);
    }
    notify();
  }, [bounds, dimensions, scaleExtent.min, scaleExtent.max, notify]);

  // Turning the tree a quarter changes every position: show the whole thing again instead of an arbitrary patch.
  const shownOrientation = useRef(orientation);
  useEffect(() => {
    if (shownOrientation.current === orientation) return;
    shownOrientation.current = orientation;
    const dims = dimensionsRef.current;
    if (dims) applyTransform(fitTransform(bounds, dims.width, dims.height, FIT_PADDING), false);
    // bounds is already the new orientation's (same render); applyTransform is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  const { visibleNodes, visibleLinks } = useMemo(() => {
    if (!committed) return { visibleNodes: [], visibleLinks: [] };
    return {
      visibleNodes: filterVisibleNodes(layout.nodes, committed.rect),
      visibleLinks: filterVisibleLinks(layout.links, committed.rect),
    };
  }, [layout, committed]);

  const linkPath = useMemo(
    () => visibleLinks.map((link) => stepPath(link.source, link.target, orientation)).join(' '),
    [visibleLinks, orientation]
  );

  const level: ZoomLevel = committed?.level ?? zoomLevelFor(initialZoom);

  const onVisibleChangeRef = useRef(onVisibleChange);
  onVisibleChangeRef.current = onVisibleChange;
  useEffect(() => {
    if (!committed || !dimensions) return;
    const t = transformRef.current;
    const nodes: VisibleChange['nodes'] = [];
    for (const node of visibleNodes) {
      if (node.data.id !== undefined) nodes.push({ id: node.data.id, x: node.x, y: node.y });
    }
    onVisibleChangeRef.current?.({
      nodes,
      level: committed.level,
      center: { x: (dimensions.width / 2 - t.x) / t.k, y: (dimensions.height / 2 - t.y) / t.k },
    });
  }, [visibleNodes, committed, dimensions]);

  const subscribe = useCallback((listener: (view: ViewState) => void) => {
    listenersRef.current.add(listener);
    listener({ ...transformRef.current, minZoom: minZoomRef.current, maxZoom: maxZoomRef.current });
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const applyTransform = useCallback((next: Transform, animate: boolean) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const target = zoomIdentity.translate(next.x, next.y).scale(next.k);
    const selection = select(svgRef.current);
    if (animate && !prefersReducedMotion()) {
      selection.transition().duration(400).call(zoomBehaviorRef.current.transform, target);
    } else {
      selection.call(zoomBehaviorRef.current.transform, target);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      centerOnNode(id: number) {
        const dims = dimensionsRef.current;
        if (!dims) return;
        const node = layout.nodes.find((n) => n.data.id === id);
        if (!node) return;
        // Landing on a bare dot is not useful: zoom in to at least the compact level.
        const k = Math.min(Math.max(transformRef.current.k, CENTER_MIN_ZOOM), maxZoomRef.current);
        applyTransform({ x: dims.width / 2 - node.x * k, y: dims.height / 2 - node.y * k, k }, true);
      },
      zoomIn() {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        select(svgRef.current).transition().duration(prefersReducedMotion() ? 0 : 400).call(zoomBehaviorRef.current.scaleBy, 1.2);
      },
      zoomOut() {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        select(svgRef.current).transition().duration(prefersReducedMotion() ? 0 : 400).call(zoomBehaviorRef.current.scaleBy, 1 / 1.2);
      },
      resetView() {
        const dims = dimensionsRef.current;
        if (!dims) return;
        const [x, y] = startOffset(dims, orientationRef.current);
        applyTransform({ x, y, k: initialZoom }, true);
      },
      fitToView() {
        const dims = dimensionsRef.current;
        if (!dims) return;
        applyTransform(fitTransform(bounds, dims.width, dims.height, FIT_PADDING), true);
      },
      setZoom(k: number) {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        select(svgRef.current).call(zoomBehaviorRef.current.scaleTo, k);
      },
      subscribe,
    }),
    [layout, bounds, initialZoom, applyTransform, subscribe]
  );

  const points = useMemo(() => layout.nodes.map((n) => ({ x: n.x, y: n.y })), [layout]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-app"
      style={{
        backgroundImage: 'radial-gradient(var(--color-grid) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <svg ref={svgRef} className="h-full w-full">
        <g ref={contentRef}>
          <path
            d={linkPath}
            className="fill-none stroke-connector"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          {visibleNodes.map(
            (node) =>
              node.children &&
              node.children.length > 1 && (
                <circle
                  key={`junction-${node.data.id}`}
                  cx={orientation === 'horizontal' ? node.x + slot.x / 2 : node.x}
                  cy={orientation === 'horizontal' ? node.y : node.y + slot.y / 2}
                  r={3}
                  className="fill-connector"
                  style={cssRadius('calc(var(--inv-k, 1) * 3px)')}
                />
              )
          )}
          {visibleNodes.map((node) => (
            <g key={node.data.id} transform={`translate(${node.x},${node.y})`}>
              {renderNode(node, level)}
            </g>
          ))}
        </g>
      </svg>
      {dimensions && (
        <Minimap
          points={points}
          bounds={bounds}
          viewport={dimensions}
          subscribe={subscribe}
          onMoveTo={(world) => {
            const k = transformRef.current.k;
            applyTransform({ x: dimensions.width / 2 - world.x * k, y: dimensions.height / 2 - world.y * k, k }, false);
          }}
        />
      )}
    </div>
  );
});

export default TreeCanvas;
