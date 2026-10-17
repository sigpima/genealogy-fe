'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sortBranches, type Branch } from '@/lib/branches/branches';
import {
  buildSearchQuery,
  EMPTY_FILTERS,
  filterProblem,
  filtersFromSearch,
  focusHref,
  focusIdFor,
  hasCriteria,
  itemSubtitle,
  PAGE_SIZE,
  pageLabel,
  type SearchFilters,
  type SearchItem,
  type SearchPage,
} from '@/lib/search/search';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40';

/** Accent-insensitive search with filters. Choosing a result opens the tree on that person. */
export function SearchView({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [page, setPage] = useState<SearchPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [searched, setSearched] = useState<SearchFilters | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const run = useCallback(
    async (active: SearchFilters, nextOffset: number) => {
      const problem = filterProblem(active);
      if (problem) {
        setMessage(problem);
        return;
      }
      if (!hasCriteria(active)) {
        setMessage('Nhập tên hoặc chọn ít nhất một bộ lọc.');
        return;
      }
      setBusy(true);
      setMessage(null);
      try {
        const response = await fetch(`/api/members/search?${buildSearchQuery(active, nextOffset)}`, {
          credentials: 'include',
        });
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        setPage((await response.json()) as SearchPage);
        setOffset(nextOffset);
        setSearched(active);
      } catch {
        setMessage('Không thể tìm kiếm lúc này. Vui lòng thử lại.');
      } finally {
        setBusy(false);
      }
    },
    [onUnauthorized],
  );

  // A first query may arrive in the address (?q=...), e.g. from the header's "Tìm nâng cao" link.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const initial = filtersFromSearch(window.location.search); // ?q=..., or filters from a statistics bar
    if (hasCriteria(initial)) {
      setFilters(initial);
      void run(initial, 0);
    }
    fetch('/api/branches', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<Branch[]>) : []))
      .then(setBranches)
      .catch(() => undefined);
  }, [run]);

  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-default">Tìm kiếm</h1>
        <p className="mt-1 text-sm text-muted">
          Gõ có dấu hay không dấu đều được. Tìm cả vợ/chồng; bấm một kết quả để mở cây tại người đó.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(filters, 0);
        }}
        className="grid gap-3 rounded-xl border-default border bg-surface p-4 sm:grid-cols-4"
      >
        <label className="block text-sm sm:col-span-4">
          <span className="text-xs text-muted">Tên</span>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="vd: nguyen van hoa"
            aria-label="Tên"
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Đời</span>
          <input inputMode="numeric" value={filters.generation} onChange={(e) => set('generation', e.target.value)} aria-label="Đời" className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Chi / phái</span>
          <select value={filters.branch} onChange={(e) => set('branch', e.target.value)} aria-label="Chi" className={field}>
            <option value="">Tất cả</option>
            {sortBranches(branches).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Sinh từ năm</span>
          <input inputMode="numeric" value={filters.bornFrom} onChange={(e) => set('bornFrom', e.target.value)} aria-label="Sinh từ năm" className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">đến năm</span>
          <input inputMode="numeric" value={filters.bornTo} onChange={(e) => set('bornTo', e.target.value)} aria-label="Sinh đến năm" className={field} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-xs text-muted">Quê quán</span>
          <input value={filters.hometown} onChange={(e) => set('hometown', e.target.value)} aria-label="Quê quán" className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Giới tính</span>
          <select value={filters.gender} onChange={(e) => set('gender', e.target.value as SearchFilters['gender'])} aria-label="Giới tính" className={field}>
            <option value="">Tất cả</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
            <option value="unknown">Chưa rõ</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Tình trạng</span>
          <select value={filters.status} onChange={(e) => set('status', e.target.value as SearchFilters['status'])} aria-label="Tình trạng" className={field}>
            <option value="">Tất cả</option>
            <option value="living">Còn sống</option>
            <option value="deceased">Đã mất</option>
            <option value="unknown">Chưa rõ</option>
          </select>
        </label>
        <div className="flex items-center gap-x-2 sm:col-span-4">
          <button type="submit" disabled={busy} className={primary}>
            Tìm
          </button>
          <button
            type="button"
            className={ghost}
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(null);
              setSearched(null);
              setMessage(null);
            }}
          >
            Xoá bộ lọc
          </button>
        </div>
      </form>

      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}

      {page && searched && (
        <section aria-label="Kết quả" aria-busy={busy}>
          <p aria-live="polite" className="text-sm text-muted">
            {pageLabel(page.total, offset, page.items.length)}
          </p>
          {page.items.length === 0 && (
            <div className="mt-3 rounded-xl border-default border bg-surface p-4 text-sm text-default">
              <p>Không tìm thấy ai khớp.</p>
              {page.suggestions.length > 0 && (
                <p className="mt-2">
                  Có phải bạn muốn tìm:{' '}
                  {page.suggestions.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 && ', '}
                      <button
                        type="button"
                        className="font-medium text-primary underline"
                        onClick={() => {
                          const next = { ...filters, q: s.full_name };
                          setFilters(next);
                          void run(next, 0);
                        }}
                      >
                        {s.full_name}
                      </button>
                    </span>
                  ))}
                  ?
                </p>
              )}
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {page.items.map((item) => (
              <ResultRow key={`${item.is_spouse ? 's' : 'm'}${item.id}`} item={item} />
            ))}
          </ul>
          {page.total > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between">
              <button type="button" className={ghost} disabled={offset === 0 || busy} onClick={() => void run(searched, Math.max(0, offset - PAGE_SIZE))}>
                ← Trước
              </button>
              <button type="button" className={ghost} disabled={offset + PAGE_SIZE >= page.total || busy} onClick={() => void run(searched, offset + PAGE_SIZE)}>
                Sau →
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ResultRow({ item }: { item: SearchItem }) {
  return (
    <li>
      <Link
        href={focusHref(focusIdFor(item))}
        className="flex min-h-14 items-center gap-x-3 rounded-xl border-default border bg-surface px-4 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
      >
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-full border-default border"
          style={{ backgroundColor: item.branch?.color ?? 'transparent' }}
        />
        <span className="min-w-0">
          <span className="font-display block truncate font-semibold text-default">
            {item.full_name}
            {item.is_spouse && <span className="ms-2 text-xs font-normal text-muted">(vợ/chồng)</span>}
          </span>
          <span className="block truncate text-xs text-muted">
            {itemSubtitle(item)}
            {item.branch ? ` · ${item.branch.name}` : ''}
          </span>
        </span>
      </Link>
    </li>
  );
}
