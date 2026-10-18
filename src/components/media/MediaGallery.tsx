'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useDialogFocus } from '@/components/common/useDialogFocus';
import { MediaCard } from '@/components/media/MediaCard';
import { UploadButton } from '@/components/media/UploadButton';
import { groupMedia } from '@/lib/media/groups';
import { imagesOf, mediaErrorMessage, stepIndex, type MediaItem } from '@/lib/media/media';
import { runUploads, type UploadState } from '@/lib/media/uploadQueue';

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

/** Photos and scanned documents of a person or place: an upload button, two groups of cards, a viewer, and (admins) caption / delete. */
export function MediaGallery({ ownerKind, ownerId, canEdit }: MediaGalleryProps) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadState | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null); // id of the image open in the viewer
  const [captioning, setCaptioning] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);

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

  async function upload(files: File[]) {
    setError(null);
    setBusy(true);
    try {
      await runUploads(
        files,
        async (file) => {
          const form = new FormData();
          form.append('file', file);
          const response = await fetch(`/api/${ownerKind}/${ownerId}/media`, { method: 'POST', credentials: 'include', body: form });
          if (!response.ok) {
            const body: unknown = await response.json().catch(() => null);
            throw new Error(`“${file.name}”: ${mediaErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail)}`);
          }
          return (await response.json()) as MediaItem;
        },
        setProgress,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveCaption(item: MediaItem, caption: string) {
    const response = await fetch(`/api/media/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    });
    if (response.ok) await load();
    else setError(mediaErrorMessage(response.status, null));
    setCaptioning(null);
  }

  async function remove(item: MediaItem) {
    const response = await fetch(`/api/media/${item.id}`, { method: 'DELETE', credentials: 'include' });
    if (response.ok) {
      setViewing(null);
      await load();
    } else setError(mediaErrorMessage(response.status, null));
    setDeleting(null);
  }

  if (items === null) return <p className="mt-2 text-sm text-muted">Đang tải...</p>;
  const images = imagesOf(items);
  const open = images.find((m) => m.id === viewing) ?? null;
  const { photos, documents } = groupMedia(items);

  const group = (title: string, list: MediaItem[]) =>
    list.length > 0 && (
      <section className="mt-3" aria-label={title}>
        <h4 className="text-sm font-semibold text-default">
          {title} ({list.length})
        </h4>
        <ul className="mt-2 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          {list.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onOpenImage={() => setViewing(item.id)}
              onEditCaption={() => setCaptioning(item)}
              onDelete={() => setDeleting(item)}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="mt-2">
      {canEdit && <UploadButton onFiles={(files) => void upload(files)} busy={busy} />}
      {progress && progress.total > 0 && (busy || progress.failed.length > 0) && (
        <div aria-live="polite" className="mt-2 text-sm text-default">
          {busy && (
            <p>
              Đang tải {Math.min(progress.done + progress.failed.length + 1, progress.total)}/{progress.total}…
            </p>
          )}
          {!busy && progress.done > 0 && <p>Đã tải lên {progress.done} file.</p>}
          {progress.failed.length > 0 && (
            <ul role="alert" className="mt-1 list-disc space-y-1 ps-5 text-danger">
              {progress.failed.map((f) => (
                <li key={f.name + f.reason}>{f.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="mt-3 text-base text-muted">Chưa có tư liệu. Ảnh, bản scan gia phả, sắc phong… đều có thể thêm ở đây.</p>
      ) : (
        <>
          {group('Ảnh', photos)}
          {group('Tài liệu', documents)}
        </>
      )}

      {open && (
        <Viewer
          images={images}
          current={open}
          canEdit={canEdit}
          onClose={() => setViewing(null)}
          onStep={(delta) => setViewing(images[stepIndex(images.indexOf(open), delta, images.length)].id)}
          onCaption={() => setCaptioning(open)}
          onDelete={() => setDeleting(open)}
        />
      )}
      {captioning && <CaptionDialog item={captioning} onSave={(text) => void saveCaption(captioning, text)} onCancel={() => setCaptioning(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Xoá tư liệu"
          message={`Xoá “${deleting.caption || deleting.original_name}”? Không khôi phục được.`}
          confirmLabel="Xoá"
          danger
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function CaptionDialog({ item, onSave, onCancel }: { item: MediaItem; onSave: (caption: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(item.caption ?? '');
  const box = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useDialogFocus(box, field);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCancel}>
      <form
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label="Sửa chú thích"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(text.trim());
        }}
        className="shadow-float w-full max-w-md rounded-t-2xl border-default border bg-surface p-5 sm:rounded-2xl"
      >
        <h2 className="font-display text-lg font-bold text-default">Sửa chú thích</h2>
        <label className="mt-3 block">
          <span className="text-base text-default">Chú thích cho “{item.original_name}”</span>
          <input ref={field} value={text} maxLength={300} onChange={(event) => setText(event.target.value)} className="mt-1 h-11 w-full rounded-lg border-default border bg-app px-3 text-base text-default focus:border-[var(--color-primary)] focus:outline-none" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border-default border px-4 text-base text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
            Huỷ
          </button>
          <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
            Lưu
          </button>
        </div>
      </form>
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
      // a caption/confirm dialog opened over the viewer owns the keys
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
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
