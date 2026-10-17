'use client';

import { useEffect, useMemo, useRef } from 'react';
import { minimapProjection, minimapToWorld, viewRectOnMinimap, worldToMinimap } from '@/lib/tree/minimap';
import { visibleRect } from '@/lib/tree/viewport';
import type { Bounds, ViewState } from '@/lib/tree/zoom';

const WIDTH = 200;
const HEIGHT = 120;

export type MinimapProps = {
  points: { x: number; y: number }[];
  bounds: Bounds;
  viewport: { width: number; height: number };
  subscribe: (listener: (view: ViewState) => void) => () => void;
  onMoveTo: (world: { x: number; y: number }) => void;
};

export function Minimap({ points, bounds, viewport, subscribe, onMoveTo }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const projection = useMemo(() => minimapProjection(bounds, WIDTH, HEIGHT), [bounds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;

    function draw() {
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-connector').trim() || '#8c7d70';
      for (const point of points) {
        const p = worldToMinimap(point, projection);
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
    }

    draw();
    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [points, projection]);

  useEffect(() => {
    return subscribe((view) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = viewRectOnMinimap(visibleRect(view, viewport.width, viewport.height, 0), projection);
      frame.style.left = `${rect.x}px`;
      frame.style.top = `${rect.y}px`;
      frame.style.width = `${rect.width}px`;
      frame.style.height = `${rect.height}px`;
    });
  }, [subscribe, viewport, projection]);

  function moveToPointer(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    onMoveTo(minimapToWorld({ x: event.clientX - box.left, y: event.clientY - box.top }, projection));
  }

  return (
    <div
      className="shadow-float absolute bottom-12 left-4 z-30 hidden overflow-hidden rounded-xl border-default border bg-glass backdrop-blur-md md:block"
      style={{ width: WIDTH, height: HEIGHT, touchAction: 'none', cursor: 'crosshair' }}
      role="img"
      aria-label="Bản đồ thu nhỏ của cây gia phả"
      onPointerDown={(event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        moveToPointer(event);
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) moveToPointer(event);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <canvas ref={canvasRef} style={{ width: WIDTH, height: HEIGHT }} />
      <div
        ref={frameRef}
        className="pointer-events-none absolute border-2 border-[var(--color-primary)]"
        style={{ background: 'rgba(139, 38, 53, 0.08)' }}
      />
    </div>
  );
}
