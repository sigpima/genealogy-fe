'use client';

import { useEffect, useRef } from 'react';
import { useDialogFocus } from '@/components/common/useDialogFocus';

export type EditorPhoto = { id: number; url: string; caption: string };

/** "Chèn ảnh": pick one of the photos already uploaded to this article. */
export function ImagePickerDialog({ photos, onPick, onCancel }: { photos: EditorPhoto[]; onPick: (photo: EditorPhoto) => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useDialogFocus(box, close);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label="Chèn ảnh"
        onClick={(event) => event.stopPropagation()}
        className="shadow-float max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-default border bg-surface p-5 sm:rounded-2xl"
      >
        <h2 className="font-display text-lg font-bold text-default">Chèn ảnh</h2>
        {photos.length === 0 ? (
          <p className="mt-3 text-base text-default">Bài chưa có ảnh nào. Hãy tải ảnh lên ở mục “Ảnh của bài” bên dưới, rồi quay lại bấm “Chèn ảnh”.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => onPick(photo)}
                  aria-label={`Chèn ảnh ${photo.caption || photo.id}`}
                  className="block w-full overflow-hidden rounded-lg border-default border text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  <span className="line-clamp-2 block p-2 text-sm text-default">{photo.caption || 'Không có chú thích'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <button ref={close} type="button" onClick={onCancel} className="min-h-11 rounded-lg border-default border px-4 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
