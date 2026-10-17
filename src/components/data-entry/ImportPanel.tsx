'use client';

import { useRef, useState } from 'react';
import { importErrorsFrom, summaryText } from '@/lib/data-entry/import';
import type { ImportRowError, ImportSummary } from '@/lib/data-entry/types';

export type ImportPanelProps = {
  /** Called after a real (not dry-run) import was applied. */
  onApplied: () => void;
};

const MAX_LISTED_ERRORS = 50;

/** CSV import in two steps: a dry run shows what would change (or every bad row), then the admin applies it. */
export function ImportPanel({ onApplied }: ImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [rowErrors, setRowErrors] = useState<ImportRowError[]>([]);
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setRowErrors([]);
    setGeneral(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function send(target: File, dryRun: boolean): Promise<ImportSummary | null> {
    setBusy(true);
    setGeneral(null);
    setRowErrors([]);
    try {
      const form = new FormData();
      form.append('file', target);
      const response = await fetch(`/api/members/import?dry_run=${dryRun}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok) return body as ImportSummary;
      const problems = importErrorsFrom(response.status, body);
      setGeneral(problems.general);
      setRowErrors(problems.rows);
      return null;
    } catch {
      setGeneral('Không thể kết nối tới máy chủ.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setDone(null);
    setPreview(null);
    setFile(picked);
    if (picked) setPreview(await send(picked, true));
  }

  async function apply() {
    if (!file) return;
    const result = await send(file, false);
    if (result) {
      setDone(`Đã nhập: ${summaryText(result)}.`);
      reset();
      onApplied();
    }
  }

  return (
    <section aria-label="Nhập từ CSV" className="rounded-xl border-default border bg-surface p-4">
      <h2 className="text-sm font-semibold text-default">Nhập từ file CSV</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Tải file về (nút “Xuất CSV”), sửa trong Excel rồi chọn lại. Dòng có cột <b>id</b> là cập nhật; dòng không có id là
        thêm con (cần <b>parent_id</b>). Ô để trống = giữ nguyên, ô <b>-</b> = xoá giá trị. Sai một dòng là cả file không được nhập.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label="Chọn file CSV"
          onChange={(e) => void onPick(e)}
          className="text-xs text-muted"
        />
        {busy && <span className="text-xs text-muted">Đang kiểm tra...</span>}
      </div>
      {done && (
        <p role="status" className="mt-3 text-sm text-default">
          {done}
        </p>
      )}
      {general && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {general}
        </p>
      )}
      {rowErrors.length > 0 && (
        <div role="alert" className="mt-3">
          <p className="text-sm text-danger">
            {rowErrors.length} dòng có lỗi — chưa nhập gì cả. Sửa file rồi chọn lại.
          </p>
          <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto ps-5 text-xs text-default">
            {rowErrors.slice(0, MAX_LISTED_ERRORS).map((e, i) => (
              <li key={i}>
                Dòng {e.row}: {e.message}
              </li>
            ))}
          </ul>
          {rowErrors.length > MAX_LISTED_ERRORS && (
            <p className="mt-1 text-xs text-muted">... và {rowErrors.length - MAX_LISTED_ERRORS} dòng nữa.</p>
          )}
        </div>
      )}
      {preview && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="status" className="text-sm text-default">
            File hợp lệ: {summaryText(preview)}.
          </p>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={busy || (preview.created === 0 && preview.updated === 0)}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
          >
            Áp dụng
          </button>
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            Bỏ qua
          </button>
        </div>
      )}
    </section>
  );
}
