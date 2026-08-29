'use client';

export type TreeControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
};

export function TreeControls({ onZoomIn, onZoomOut, onReset }: TreeControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-y-2">
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Phóng to"
        className="size-9 rounded-full border-default border bg-surface text-default shadow-md hover:bg-app"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Thu nhỏ"
        className="size-9 rounded-full border-default border bg-surface text-default shadow-md hover:bg-app"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label="Về vị trí ban đầu"
        className="size-9 rounded-full border-default border bg-surface text-default shadow-md hover:bg-app"
      >
        ⟳
      </button>
    </div>
  );
}
