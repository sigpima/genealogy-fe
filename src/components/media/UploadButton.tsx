'use client';

import { useRef, useState } from 'react';
import { ACCEPT_ATTRIBUTE } from '@/lib/media/media';

/** The one obvious way to add files: a big button (and, on wide screens, dropping files onto the box). */
export function UploadButton({ onFiles, busy }: { onFiles: (files: File[]) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) onFiles(files);
    if (input.current) input.current.value = '';
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!busy) pick(event.dataTransfer.files);
      }}
      className={`rounded-xl border border-dashed p-3 ${dragging ? 'border-[var(--color-primary)] bg-surface-muted' : 'border-default'}`}
    >
      <input ref={input} type="file" multiple accept={ACCEPT_ATTRIBUTE} hidden tabIndex={-1} aria-hidden="true" onChange={(event) => pick(event.target.files)} />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50 sm:w-auto"
      >
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
        </svg>
        {busy ? 'Đang tải lên…' : 'Thêm ảnh hoặc tài liệu'}
      </button>
      <p className="mt-2 text-sm text-muted">
        Ảnh JPEG, PNG, WebP hoặc PDF, tối đa 10 MB mỗi file. Có thể chọn nhiều file một lúc<span className="hidden md:inline"> hoặc kéo thả vào khung này</span>.
      </p>
    </div>
  );
}
