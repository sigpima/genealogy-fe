'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACCEPT_ATTRIBUTE,
  formatSize,
  imagesOf,
  mediaErrorMessage,
  stepIndex,
  uploadProblem,
  type MediaItem,
} from '@/lib/media/media';

const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

export type MediaGalleryProps = {
  ownerKind: 'members' | 'places';
  ownerId: number;
  /** Admins upload, caption and delete; everybody else only looks. */
  canEdit: boolean;
};

/** Photos and scanned documents of a person or place: thumbnails, a viewer, and (admins) upload / caption / delete. */
export function MediaGallery({ ownerKind, ownerId, canEdit }: MediaGalleryProps) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null); // id of the image open in the viewer
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/${ownerKind}/${ownerId}/media`, { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      setItems((await response.json()) as MediaItem[]);
    } catch {
      setItems([]);
    }
  }, [ownerKind, ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const problem = uploadProblem(file);
        if (problem) {
          setError(problem);
          continue;
        }
        const form = new FormData();
        form.append('file', file);
        const response = await fetch(`/api/${ownerKind}/${ownerId}/media`, { method: 'POST', credentials: 'include', body: form });
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          setError(`${file.name}: ${mediaErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail)}`);
        }
      }
      await load();
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function saveCaption(item: MediaItem) {
    const next = window.prompt('Chú thích', item.caption ?? '');
    if (next === null) return;
    const response = await fetch(`/api/media/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: next }),
    });
    if (response.ok) await load();
    else setError(mediaErrorMessage(response.status, null));
  }

  async function remove(item: MediaItem) {
    if (!window.confirm(`Xoá “${item.caption || item.original_name}”?`)) return;
    const response = await fetch(`/api/media/${item.id}`, { method: 'DELETE', credentials: 'include' });
    if (response.ok) {
      setViewing(null);
      await load();
    } else setError(mediaErrorMessage(response.status, null));
  }

  if (items === null) return <p className="mt-2 text-sm text-muted">Đang tải...</p>;
  const images = imagesOf(items);
  const open = images.find((m) => m.id === viewing) ?? null;

  return (
    <div className="mt-2">
      {items.length === 0 && <p className="text-sm text-muted">Chưa có ảnh hay tài liệu.</p>}
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              {item.kind === 'image' ? (
                <button
                  type="button"
                  onClick={() => setViewing(item.id)}
                  aria-label={`Xem ảnh ${item.caption || item.original_name}`}
                  className="block aspect-square w-full overflow-hidden rounded-lg border-default border bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.thumb_url ?? item.url} alt={item.caption ?? item.original_name} loading="lazy" className="size-full object-cover" />
                </button>
              ) : (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Mở tài liệu ${item.caption || item.original_name}`}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-y-1 rounded-lg border-default border bg-surface-muted p-2 text-center text-xs text-default hover:bg-surface focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                  <span aria-hidden="true" className="text-2xl">📄</span>
                  <span className="line-clamp-2 break-all">{item.caption || item.original_name}</span>
                  <span className="text-muted">{formatSize(item.size)}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-2">
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            aria-label="Tải ảnh hoặc tài liệu lên"
            disabled={busy}
            onChange={(e) => void upload(e.target.files)}
            className="text-xs text-muted"
          />
          <p className="mt-1 text-xs text-muted">Ảnh JPEG/PNG/WebP hoặc PDF, tối đa 10 MB mỗi file.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {open && (
        <Viewer
          images={images}
          current={open}
          canEdit={canEdit}
          onClose={() => setViewing(null)}
          onStep={(delta) => setViewing(images[stepIndex(images.indexOf(open), delta, images.length)].id)}
          onCaption={() => void saveCaption(open)}
          onDelete={() => void remove(open)}
        />
      )}
    </div>
  );
}

function Viewer({
  images,
  current,
  canEdit,
  onClose,
  onStep,
  onCaption,
  onDelete,
}: {
  images: MediaItem[];
  current: MediaItem;
  canEdit: boolean;
  onClose: () => void;
  onStep: (delta: number) => void;
  onCaption: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onStep(1);
      if (event.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onStep]);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Xem ảnh" className="flex min-h-0 flex-1 flex-col outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 text-sm text-white">
          <span className="min-w-0 truncate">{current.caption || current.original_name}</span>
          <div className="flex items-center">
            <a href={current.url} target="_blank" rel="noreferrer" className="min-h-11 rounded-lg px-3 leading-[2.75rem] text-white/80 hover:text-white">
              Mở ảnh gốc
            </a>
            {canEdit && (
              <>
                <button type="button" className={`${ghost} !text-white/80 hover:!text-white`} onClick={onCaption}>
                  Chú thích
                </button>
                <button type="button" className={danger} onClick={onDelete}>
                  Xoá
                </button>
              </>
            )}
            <button type="button" className={`${ghost} !text-white/80 hover:!text-white`} onClick={onClose}>
              Đóng ✕
            </button>
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={current.caption ?? current.original_name} className="max-h-full max-w-full object-contain" />
          {images.length > 1 && (
            <>
              <button type="button" aria-label="Ảnh trước" onClick={() => onStep(-1)} className="absolute start-2 top-1/2 size-11 -translate-y-1/2 rounded-full bg-white/15 text-xl text-white hover:bg-white/30">
                ‹
              </button>
              <button type="button" aria-label="Ảnh sau" onClick={() => onStep(1)} className="absolute end-2 top-1/2 size-11 -translate-y-1/2 rounded-full bg-white/15 text-xl text-white hover:bg-white/30">
                ›
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
