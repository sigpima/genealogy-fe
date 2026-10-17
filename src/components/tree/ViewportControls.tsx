'use client';

import { useEffect, useState } from 'react';
import type { TreeCanvasHandle } from './TreeCanvas';
import type { ViewState } from '@/lib/tree/zoom';

export type ViewportControlsProps = {
  handle: TreeCanvasHandle | null;
};

const buttonClass =
  'flex size-11 items-center justify-center rounded-lg text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

export function ViewportControls({ handle }: ViewportControlsProps) {
  const [view, setView] = useState<ViewState | null>(null);

  useEffect(() => {
    if (!handle) return;
    // Panning changes x/y only; keep the previous state object so pan frames cause no re-render.
    return handle.subscribe((next) =>
      setView((prev) =>
        prev && prev.k === next.k && prev.minZoom === next.minZoom && prev.maxZoom === next.maxZoom ? prev : next
      )
    );
  }, [handle]);

  const percent = view ? Math.round(view.k * 100) : 100;

  return (
    <div className="shadow-float absolute bottom-12 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-x-1 rounded-xl border-default border bg-glass px-2 py-1 backdrop-blur-md">
      <button type="button" aria-label="Thu nhỏ" onClick={() => handle?.zoomOut()} className={buttonClass}>
        −
      </button>
      <input
        type="range"
        aria-label="Mức thu phóng"
        min={view ? Math.round(view.minZoom * 1000) : 150}
        max={view ? Math.round(view.maxZoom * 1000) : 2500}
        value={view ? Math.round(view.k * 1000) : 900}
        onChange={(event) => handle?.setZoom(Number(event.target.value) / 1000)}
        className="hidden w-28 accent-[var(--color-primary)] sm:block"
      />
      <span className="w-12 text-center text-xs font-semibold text-default" aria-live="off">
        {percent}%
      </span>
      <button type="button" aria-label="Phóng to" onClick={() => handle?.zoomIn()} className={buttonClass}>
        +
      </button>
      <button
        type="button"
        onClick={() => handle?.resetView()}
        className="min-h-11 whitespace-nowrap rounded-lg px-2 text-xs text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={() => handle?.fitToView()}
        className="min-h-11 whitespace-nowrap rounded-lg bg-surface-muted px-3 text-xs font-medium text-default hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        Toàn cảnh
      </button>
    </div>
  );
}
