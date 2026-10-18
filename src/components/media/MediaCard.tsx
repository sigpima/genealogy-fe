'use client';

import { useEffect, useRef, useState } from 'react';
import { formatSize, type MediaItem } from '@/lib/media/media';

type Props = {
  item: MediaItem;
  canEdit: boolean;
  onOpenImage: () => void;
  onEditCaption: () => void;
  onDelete: () => void;
};

const menuItem =
  'flex min-h-11 w-full items-center px-3 text-left text-base hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]';

/** One photo or document: a fixed-shape thumbnail, the caption underneath, and (admins) a ⋯ menu beside the caption — nothing sits on top of the picture. */
export function MediaCard({ item, canEdit, onOpenImage, onEditCaption, onDelete }: Props) {
  const label = item.caption || item.original_name;
  return (
    <li className="min-w-0 overflow-hidden rounded-xl border-default border bg-surface">
      {item.kind === 'image' ? (
        <button
          type="button"
          onClick={onOpenImage}
          aria-label={`Xem ảnh ${label}`}
          className="block aspect-[4/3] w-full overflow-hidden bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumb_url ?? item.url} alt="" loading="lazy" className="size-full object-cover" />
        </button>
      ) : (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Mở tài liệu ${label}`}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-surface-muted p-3 text-center text-default hover:bg-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M9 13h6M9 17h6" />
          </svg>
          <span className="text-sm font-semibold">PDF</span>
        </a>
      )}
      <div className="flex items-start gap-1 p-2 ps-3">
        <div className="min-w-0 flex-1 py-1">
          <p className="line-clamp-2 break-words text-sm font-medium text-default">{label}</p>
          <p className="text-sm text-muted">{formatSize(item.size)}</p>
        </div>
        {canEdit && <CardMenu label={label} onEditCaption={onEditCaption} onDelete={onDelete} />}
      </div>
    </li>
  );
}

function CardMenu({ label, onEditCaption, onDelete }: { label: string; onEditCaption: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    const items = [...(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.stopPropagation(); // do not let the profile panel close as well
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div ref={box} className="relative shrink-0" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-label={`Tuỳ chọn cho ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label="Tuỳ chọn" className="shadow-float absolute end-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border-default border bg-surface">
          <button
            type="button"
            role="menuitem"
            className={`${menuItem} text-default`}
            onClick={() => {
              setOpen(false);
              onEditCaption();
            }}
          >
            Sửa chú thích
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${menuItem} text-danger`}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Xoá
          </button>
        </div>
      )}
    </div>
  );
}
