'use client';

import { useEffect, useState } from 'react';
import type { TreeCanvasHandle } from './TreeCanvas';

export type StatusStripProps = {
  total: number;
  generations: number;
  handle: TreeCanvasHandle | null;
};

export function StatusStrip({ total, generations, handle }: StatusStripProps) {
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    if (!handle) return;
    return handle.subscribe((view) => setZoomPercent(Math.round(view.k * 100)));
  }, [handle]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-x-6 border-default border-t bg-glass px-4 py-2 text-xs text-muted backdrop-blur-md">
      <span>
        Nhân khẩu: <strong className="text-default">{total}</strong> người
      </span>
      <span>
        Quy mô: <strong className="text-default">{generations}</strong> thế hệ
      </span>
      <span className="ml-auto">Tỉ lệ: {zoomPercent}%</span>
    </div>
  );
}
