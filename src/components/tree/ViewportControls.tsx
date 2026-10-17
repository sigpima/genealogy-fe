'use client';

import { useEffect, useState } from 'react';
import type { TreeCanvasHandle } from './TreeCanvas';
import type { ViewState } from '@/lib/tree/zoom';

export type ViewportControlsProps = {
  canvasRef: React.RefObject<TreeCanvasHandle | null>;
};

const buttonClass =
  'flex size-11 items-center justify-center rounded-lg text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

export function ViewportControls({ canvasRef }: ViewportControlsProps) {
  const [view, setView] = useState<ViewState | null>(null);

  useEffect(() => {
    // The canvas handle is attached after the first commit of the (dynamically loaded) canvas,
    // so retry until it exists.
    let unsubscribe: (() => void) | undefined;
    const attach = () => {
      const handle = canvasRef.current;
      if (!handle) return false;
      unsubscribe = handle.subscribe(setView);
      return true;
    };
    if (attach()) return () => unsubscribe?.();
    const timer = setInterval(() => {
      if (attach()) clearInterval(timer);
    }, 100);
    return () => {
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [canvasRef]);

  const percent = view ? Math.round(view.k * 100) : 100;

  return (
    <div className="shadow-float absolute bottom-12 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-x-1 rounded-xl border-default border bg-surface/90 px-2 py-1 backdrop-blur-md">
      <button type="button" aria-label="Thu nhỏ" onClick={() => canvasRef.current?.zoomOut()} className={buttonClass}>
        −
      </button>
      <input
        type="range"
        aria-label="Mức thu phóng"
        min={view ? Math.round(view.minZoom * 1000) : 150}
        max={view ? Math.round(view.maxZoom * 1000) : 2500}
        value={view ? Math.round(view.k * 1000) : 900}
        onChange={(event) => canvasRef.current?.setZoom(Number(event.target.value) / 1000)}
        className="hidden w-28 accent-[var(--color-primary)] sm:block"
      />
      <span className="w-12 text-center text-xs font-semibold text-default" aria-live="off">
        {percent}%
      </span>
      <button type="button" aria-label="Phóng to" onClick={() => canvasRef.current?.zoomIn()} className={buttonClass}>
        +
      </button>
      <button
        type="button"
        onClick={() => canvasRef.current?.resetView()}
        className="min-h-11 rounded-lg px-2 text-xs text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={() => canvasRef.current?.fitToView()}
        className="min-h-11 rounded-lg bg-surface-muted px-3 text-xs font-medium text-default hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        Toàn cảnh
      </button>
    </div>
  );
}
