'use client';

import { useCallback, useEffect, useState } from 'react';
import { CompletenessCards } from '@/components/data-entry/CompletenessCards';
import { EditableCell } from './EditableCell';
import { ImportPanel } from './ImportPanel';
import { SplitDialog } from './SplitDialog';
import { canBeAdopted } from '@/lib/tree/memberRules';
import { patchErrorMessage } from '@/lib/data-entry/cells';
import {
  buildTableQuery,
  EMPTY_FILTERS,
  filtersFromAddress,
  hasActiveFilters,
  pageRange,
  PAGE_SIZE,
  toggleMissing,
} from '@/lib/data-entry/table';
import {
  MISSING_FIELDS,
  type Completeness,
  type TableFilters,
  type TablePage,
  type TableRow,
} from '@/lib/data-entry/types';

const chip =
  'min-h-11 rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const smallButton =
  'min-h-11 whitespace-nowrap rounded-lg px-2 text-xs text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40';
const filterInput =
  'min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';

type Field = keyof TableRow;

/** The data-entry grid: filters, completeness, inline editing (one PATCH per cell), split, CSV. */
export function DataEntry({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);
  const [qDraft, setQDraft] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<TablePage | null>(null);
  const [completeness, setCompleteness] = useState<Completeness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [splitting, setSplitting] = useState<TableRow | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showImport, setShowImport] = useState(false);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  // /nhap-lieu?missing=avatar&generation=3 (a row of the statistics page's completeness board) starts pre-filtered.
  useEffect(() => {
    const initial = filtersFromAddress(window.location.search, MISSING_FIELDS);
    if (hasActiveFilters(initial)) setFilters(initial);
  }, []);

  // Typing in the search box filters 300 ms after the last keystroke, not on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((f) => (f.q === qDraft ? f : { ...f, q: qDraft }));
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [qDraft]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [tableResponse, completenessResponse] = await Promise.all([
          fetch(`/api/members/table?${buildTableQuery(filters, offset)}`, { credentials: 'include' }),
          fetch('/api/members/completeness', { credentials: 'include' }),
        ]);
        if (cancelled) return;
        if (tableResponse.status === 401 || tableResponse.status === 403) {
          onUnauthorized();
          return;
        }
        if (!tableResponse.ok) throw new Error('table');
        setPage((await tableResponse.json()) as TablePage);
        if (completenessResponse.ok) setCompleteness((await completenessResponse.json()) as Completeness);
        setError(null);
      } catch {
        if (!cancelled) setError('Không tải được dữ liệu. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [filters, offset, reloadToken, onUnauthorized]);

  function changeFilters(next: Partial<TableFilters>) {
    setFilters((f) => ({ ...f, ...next }));
    setOffset(0);
  }

  /** PATCH one field; on success the row (and the progress bar) follow the saved value. */
  async function saveField(row: TableRow, field: Field, value: string | number | boolean | null): Promise<string | null> {
    try {
      const response = await fetch(`/api/members/${row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) return patchErrorMessage(response.status);
      const saved = (await response.json()) as Partial<TableRow>;
      setPage((p) =>
        p ? { ...p, items: p.items.map((r) => (r.id === row.id ? { ...r, [field]: saved[field] ?? null } : r)) } : p
      );
      void refreshCompleteness();
      return null;
    } catch {
      return 'Không thể kết nối tới máy chủ.';
    }
  }

  async function refreshCompleteness() {
    try {
      const response = await fetch('/api/members/completeness', { credentials: 'include' });
      if (response.ok) setCompleteness((await response.json()) as Completeness);
    } catch {
      /* the bar just stays as it was */
    }
  }

  async function split(row: TableRow, names: string[]): Promise<string | null> {
    try {
      const response = await fetch(`/api/members/${row.id}/split`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      });
      if (response.status === 409) return 'Không tách được: người này đã có con hoặc vợ/chồng.';
      if (!response.ok) return 'Không thể tách. Vui lòng thử lại.';
      setSplitting(null);
      reload();
      return null;
    } catch {
      return 'Không thể kết nối tới máy chủ.';
    }
  }

  const items = page?.items ?? [];
  const total = page?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-default">Nhập liệu</h1>
          <p className="mt-1 text-sm text-muted">Sửa trực tiếp từng ô — mỗi ô tự lưu khi bạn rời khỏi ô (Enter để lưu, Esc để huỷ).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/members/export.csv"
            download
            className="flex min-h-11 items-center rounded-lg border-default border px-4 text-sm text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            Xuất CSV
          </a>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            aria-expanded={showImport}
            className="min-h-11 rounded-lg border-default border px-4 text-sm text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            Nhập CSV
          </button>
        </div>
      </div>

      {completeness && (
        <CompletenessCards
          completeness={completeness}
          active={filters.missing}
          onToggle={(field) => changeFilters({ missing: toggleMissing(filters.missing, field) })}
        />
      )}

      {showImport && <ImportPanel onApplied={reload} />}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Tìm theo tên"
          placeholder="Tìm theo tên..."
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
          className={`${filterInput} w-56`}
        />
        <input
          type="number"
          min={1}
          aria-label="Lọc theo đời"
          placeholder="Đời..."
          value={filters.generation ?? ''}
          onChange={(e) => changeFilters({ generation: e.target.value ? Number(e.target.value) : null })}
          className={`${filterInput} w-24`}
        />
        {filters.under !== null && (
          <button
            type="button"
            onClick={() => {
              changeFilters({ under: null });
              setBranchName(null);
            }}
            className={`${chip} border-[var(--color-primary)] bg-surface text-primary`}
          >
            Nhánh: {branchName ?? `#${filters.under}`} ✕
          </button>
        )}
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => {
              setQDraft('');
              setBranchName(null);
              setFilters(EMPTY_FILTERS);
              setOffset(0);
            }}
            className={smallButton}
          >
            Xoá bộ lọc
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}{' '}
          <button type="button" onClick={reload} className="underline">
            Thử lại
          </button>
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border-default border bg-surface" aria-busy={loading}>
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-surface-muted text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Đời</th>
              <th scope="col" className="px-3 py-2 font-semibold">Họ tên</th>
              <th scope="col" className="px-3 py-2 font-semibold">Cha</th>
              <th scope="col" className="px-3 py-2 font-semibold">Giới tính</th>
              <th scope="col" className="px-3 py-2 font-semibold">Năm sinh</th>
              <th scope="col" className="px-3 py-2 font-semibold">Năm mất</th>
              <th scope="col" className="px-3 py-2 font-semibold">Quê quán</th>
              <th scope="col" className="px-3 py-2 font-semibold">Con thứ</th>
              <th scope="col" className="px-3 py-2 font-semibold">Nuôi</th>
              <th scope="col" className="px-3 py-2 font-semibold"><span className="sr-only">Thao tác</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-default border-t align-top">
                <td className="px-3 py-1.5 pt-3 text-muted">{row.generation}</td>
                <td className="min-w-52 px-1 py-1">
                  <EditableCell
                    kind="requiredText"
                    label={`Họ tên của ${row.full_name}`}
                    value={row.full_name}
                    onSave={(v) => saveField(row, 'full_name', v)}
                  />
                </td>
                <td className="px-3 py-1.5 pt-3 text-muted">{row.parent_name ?? '—'}</td>
                <td className="px-1 py-1">
                  <select
                    aria-label={`Giới tính của ${row.full_name}`}
                    value={row.gender ?? ''}
                    onChange={(e) => void saveField(row, 'gender', e.target.value || null)}
                    className="min-h-9 w-24 rounded border border-transparent bg-transparent px-1 text-sm text-default hover:border-default focus:border-[var(--color-primary)] focus:outline-none"
                  >
                    <option value="">—</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </td>
                <td className="w-24 px-1 py-1">
                  <EditableCell
                    kind="year"
                    inputMode="numeric"
                    label={`Năm sinh của ${row.full_name}`}
                    value={row.birth_year}
                    onSave={(v) => saveField(row, 'birth_year', v)}
                  />
                </td>
                <td className="w-24 px-1 py-1">
                  <EditableCell
                    kind="year"
                    inputMode="numeric"
                    label={`Năm mất của ${row.full_name}`}
                    value={row.death_year}
                    onSave={(v) => saveField(row, 'death_year', v)}
                  />
                </td>
                <td className="min-w-40 px-1 py-1">
                  <EditableCell
                    kind="text"
                    label={`Quê quán của ${row.full_name}`}
                    value={row.hometown}
                    onSave={(v) => saveField(row, 'hometown', v)}
                  />
                </td>
                <td className="w-20 px-1 py-1">
                  <EditableCell
                    kind="order"
                    inputMode="numeric"
                    label={`Con thứ của ${row.full_name}`}
                    value={row.birth_order}
                    onSave={(v) => saveField(row, 'birth_order', v)}
                  />
                </td>
                <td className="px-3 py-1.5 pt-3">
                  <input
                    type="checkbox"
                    aria-label={`${row.full_name} là con nuôi`}
                    checked={row.is_adopted}
                    disabled={!canBeAdopted(row) && !row.is_adopted}
                    title={canBeAdopted(row) ? undefined : 'Người không có cha không thể là con nuôi'}
                    onChange={(e) => void saveField(row, 'is_adopted', e.target.checked)}
                  />
                </td>
                <td className="whitespace-nowrap px-1 py-1">
                  {row.has_children && (
                    <button
                      type="button"
                      onClick={() => {
                        setBranchName(row.full_name);
                        changeFilters({ under: row.id });
                      }}
                      className={smallButton}
                      aria-label={`Chỉ xem nhánh ${row.full_name}`}
                    >
                      Nhánh
                    </button>
                  )}
                  {!row.has_children && (
                    <button type="button" onClick={() => setSplitting(row)} className={smallButton} aria-label={`Tách ${row.full_name}`}>
                      Tách
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted">
                  Không có thành viên nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span aria-live="polite">{pageRange(total, offset, items.length)}</span>
        <div className="flex items-center gap-x-2">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className={smallButton}>
            ← Trước
          </button>
          <button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)} className={smallButton}>
            Sau →
          </button>
        </div>
      </div>

      {splitting && (
        <SplitDialog memberName={splitting.full_name} onCancel={() => setSplitting(null)} onSubmit={(names) => split(splitting, names)} />
      )}
    </div>
  );
}
