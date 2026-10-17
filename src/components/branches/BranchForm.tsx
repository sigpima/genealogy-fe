'use client';

import { useEffect, useState } from 'react';
import { branchErrorMessage, isHexColor, type Branch } from '@/lib/branches/branches';
import type { SearchItem, SearchPage } from '@/lib/search/search';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

const DEFAULT_PICKER_COLOR = '#8b1a1a';

/** Create or edit a branch. The head is chosen by searching for the person (blood members only). */
export function BranchForm({
  branch,
  onSaved,
  onCancel,
}: {
  branch?: Branch;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(branch?.name ?? '');
  const [description, setDescription] = useState(branch?.description ?? '');
  const [color, setColor] = useState(branch?.color ?? '');
  const [head, setHead] = useState<{ id: number; name: string } | null>(
    branch ? { id: branch.root_member_id, name: branch.root_name } : null,
  );
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Look people up as the admin types (debounced); spouses cannot head a branch, so they are left out.
  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/members/search?${new URLSearchParams({ q: text, limit: '8' })}`, { credentials: 'include' })
        .then((r) => (r.ok ? (r.json() as Promise<SearchPage>) : null))
        .then((page) => setOptions((page?.items ?? []).filter((item) => !item.is_spouse)))
        .catch(() => setOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!head) {
      setMessage('Chọn người đứng đầu chi.');
      return;
    }
    if (color && !isHexColor(color)) {
      setMessage('Màu phải có dạng #rrggbb.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(branch ? `/api/branches/${branch.id}` : '/api/branches', {
        method: branch ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, root_member_id: head.id, color: color || null, description: description || null }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setMessage(branchErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail));
        return;
      }
      await onSaved();
    } catch {
      setMessage('Không thể kết nối tới máy chủ.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="text-xs text-muted">Tên chi</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={150} aria-label="Tên chi" className={field} placeholder="Chi trưởng" />
      </label>
      <div className="block text-sm">
        <span className="text-xs text-muted">Màu (để trống = tự chọn)</span>
        <div className="mt-1 flex items-center gap-x-2">
          <input
            type="color"
            aria-label="Chọn màu"
            value={isHexColor(color) ? color : DEFAULT_PICKER_COLOR}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border-default border bg-app p-1"
          />
          <input value={color} onChange={(e) => setColor(e.target.value)} aria-label="Mã màu" placeholder="#8b1a1a" maxLength={7} className={`${field} mt-0`} />
        </div>
      </div>
      <div className="sm:col-span-2">
        <span className="text-xs text-muted">Trưởng chi (người đứng đầu)</span>
        {head && (
          <p className="mt-1 flex items-center gap-x-2 text-sm text-default">
            <b>{head.name}</b>
            <button type="button" className={ghost} onClick={() => setHead(null)}>
              Đổi người
            </button>
          </p>
        )}
        {!head && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm trưởng chi"
              placeholder="Gõ tên để tìm (có dấu hay không đều được)..."
              className={field}
            />
            {options.length > 0 && (
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border-default border bg-surface">
                {options.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setHead({ id: item.id, name: item.full_name });
                        setQuery('');
                        setOptions([]);
                      }}
                      className="block min-h-11 w-full px-3 py-2 text-left text-sm text-default hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {item.full_name} <span className="text-xs text-muted">· đời {item.generation}{item.parent_name ? ` · con ${item.parent_name}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <label className="block text-sm sm:col-span-2">
        <span className="text-xs text-muted">Mô tả (tuỳ chọn)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} aria-label="Mô tả" className={`${field} py-2`} />
      </label>
      {message && (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {message}
        </p>
      )}
      <div className="flex gap-x-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={primary}>
          Lưu
        </button>
        <button type="button" className={ghost} onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </form>
  );
}
