'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArticleEditor } from './ArticleEditor';
import { PersonPicker } from '@/components/common/PersonPicker';
import {
  ARTICLE_KIND_LABELS,
  century,
  chroniclesErrorMessage,
  EMPTY_TIMELINE_FORM,
  formatTimelineDate,
  timelinePayload,
  timelineToForm,
  wordsPayload,
  wordsToRows,
  type Article,
  type ArticleKind,
  type ArticleSummary,
  type GenerationWord,
  type TimelineEntry,
  type TimelineForm,
  type WordRow,
} from '@/lib/chronicles/chronicles';
import { focusHref } from '@/lib/search/search';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

type Tab = 'articles' | 'timeline' | 'words';

async function getJson<T>(url: string, unauthorized: () => void): Promise<T | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (response.status === 401) unauthorized();
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Sử ký: articles (tộc ước, nguồn gốc...), the clan's timeline and the bài đệm. Admins write, everyone else reads. */
export function ChroniclesView({ isAdmin, onUnauthorized }: { isAdmin: boolean; onUnauthorized: () => void }) {
  const [tab, setTab] = useState<Tab>('articles');
  const [editing, setEditing] = useState<{ article: Article | null } | null>(null);

  // /su-ky?sua=ID opens the editor on an article, /su-ky?moi=1 on a blank one (the reader's "Sửa" button, the empty state).
  useEffect(() => {
    if (!isAdmin) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('sua');
    if (id && /^\d+$/.test(id)) {
      getJson<Article>(`/api/articles/${id}`, onUnauthorized).then((a) => a && setEditing({ article: a }));
    } else if (params.get('moi')) {
      setEditing({ article: null });
    }
  }, [isAdmin, onUnauthorized]);

  if (editing) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <ArticleEditor
          article={editing.article}
          onCancel={() => setEditing(null)}
          onDone={(saved) => {
            setEditing(null);
            window.history.replaceState(null, '', '/su-ky');
            if (saved) window.location.assign(`/su-ky/${saved.slug}`);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-default">Sử ký dòng họ</h1>
          <p className="mt-1 text-sm text-muted">Nguồn gốc, thế thứ, tộc ước, câu chuyện các bậc tiền nhân và dòng thời gian của họ.</p>
        </div>
        {isAdmin && tab === 'articles' && (
          <button type="button" className={primary} onClick={() => setEditing({ article: null })}>
            Viết bài mới
          </button>
        )}
      </div>
      <div role="tablist" aria-label="Mục sử ký" className="flex border-default border-b">
        {(
          [
            ['articles', 'Bài viết'],
            ['timeline', 'Dòng thời gian'],
            ['words', 'Bài đệm'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 border-b-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
              tab === id ? 'border-[var(--color-primary)] text-primary' : 'border-transparent text-muted hover:text-default'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'articles' && <ArticlesTab isAdmin={isAdmin} onUnauthorized={onUnauthorized} />}
      {tab === 'timeline' && <TimelineTab isAdmin={isAdmin} onUnauthorized={onUnauthorized} />}
      {tab === 'words' && <WordsTab isAdmin={isAdmin} onUnauthorized={onUnauthorized} />}
    </div>
  );
}

function ArticlesTab({ isAdmin, onUnauthorized }: { isAdmin: boolean; onUnauthorized: () => void }) {
  const [items, setItems] = useState<ArticleSummary[] | null>(null);
  const [kind, setKind] = useState<'' | ArticleKind>('');
  useEffect(() => {
    getJson<ArticleSummary[]>(`/api/articles${kind ? `?kind=${kind}` : ''}`, onUnauthorized).then(setItems);
  }, [kind, onUnauthorized]);
  return (
    <section aria-label="Bài viết">
      <div className="flex flex-wrap gap-2">
        {([['', 'Tất cả'], ...Object.entries(ARTICLE_KIND_LABELS)] as [string, string][]).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k as '' | ArticleKind)}
            className={`min-h-11 rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
              kind === k ? 'border-[var(--color-primary)] bg-primary text-on-primary' : 'border-default bg-surface text-default hover:bg-surface-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {items && items.length === 0 && (
        <p className="mt-4 text-sm text-muted">Chưa có bài viết nào.{isAdmin ? ' Bấm “Viết bài mới” để bắt đầu với tộc ước hoặc nguồn gốc dòng họ.' : ''}</p>
      )}
      <ul className="mt-4 space-y-3">
        {(items ?? []).map((a) => (
          <li key={a.id}>
            <Link
              href={`/su-ky/${a.slug}`}
              className="flex gap-x-4 rounded-xl border-default border bg-surface p-4 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              {a.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.cover_url} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
              )}
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-display text-lg font-bold text-default">{a.title}</span>
                  {a.pinned && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-primary">Ghim</span>}
                  {a.status === 'draft' && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">Bản nháp</span>}
                </span>
                <span className="text-xs text-muted">{ARTICLE_KIND_LABELS[a.kind]}</span>
                <span className="mt-1 line-clamp-2 block text-sm text-default">{a.excerpt}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TimelineTab({ isAdmin, onUnauthorized }: { isAdmin: boolean; onUnauthorized: () => void }) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [form, setForm] = useState<{ id: number | null; values: TimelineForm; person: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => getJson<TimelineEntry[]>('/api/timeline', onUnauthorized).then(setEntries), [onUnauthorized]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const result = timelinePayload(form.values);
    if (!result.ok) return setError(result.error);
    const response = await fetch(form.id === null ? '/api/timeline' : `/api/timeline/${form.id}`, {
      method: form.id === null ? 'POST' : 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result.payload, article_id: null }),
    });
    if (!response.ok) return setError(chroniclesErrorMessage(response.status));
    setForm(null);
    setError(null);
    await load();
  }

  async function remove(entry: TimelineEntry) {
    if (!window.confirm(`Xoá “${entry.title}”?`)) return;
    const response = await fetch(`/api/timeline/${entry.id}`, { method: 'DELETE', credentials: 'include' });
    if (response.ok) await load();
    else setError(chroniclesErrorMessage(response.status));
  }

  let lastCentury = '';
  return (
    <section aria-label="Dòng thời gian">
      {isAdmin && !form && (
        <button type="button" className={primary} onClick={() => setForm({ id: null, values: EMPTY_TIMELINE_FORM, person: null })}>
          Thêm mốc
        </button>
      )}
      {form && (
        <form onSubmit={save} className="space-y-3 rounded-xl border-default border bg-surface p-4" aria-label="Biểu mẫu mốc thời gian">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['year', 'Năm'],
                ['month', 'Tháng (tuỳ chọn)'],
                ['day', 'Ngày (tuỳ chọn)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-xs text-muted">{label}</span>
                <input inputMode="numeric" value={form.values[key]} onChange={(e) => setForm({ ...form, values: { ...form.values, [key]: e.target.value } })} aria-label={label} className={field} />
              </label>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-xs text-muted">Sự kiện</span>
            <input required value={form.values.title} onChange={(e) => setForm({ ...form, values: { ...form.values, title: e.target.value } })} maxLength={200} aria-label="Sự kiện" className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted">Chi tiết (tuỳ chọn)</span>
            <textarea value={form.values.body} onChange={(e) => setForm({ ...form, values: { ...form.values, body: e.target.value } })} rows={3} aria-label="Chi tiết mốc" className={`${field} py-2`} />
          </label>
          <div className="text-sm">
            <span className="text-xs text-muted">Người liên quan (tuỳ chọn)</span>
            {form.values.member_id !== null ? (
              <p className="mt-1 flex items-center gap-x-2 text-default">
                <b>{form.person ?? `#${form.values.member_id}`}</b>
                <button type="button" className={ghost} onClick={() => setForm({ ...form, person: null, values: { ...form.values, member_id: null } })}>
                  Bỏ
                </button>
              </p>
            ) : (
              <PersonPicker label="Tìm người liên quan" onPick={(p) => setForm({ ...form, person: p.name, values: { ...form.values, member_id: p.id } })} />
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-x-2">
            <button type="submit" className={primary}>
              Lưu
            </button>
            <button type="button" className={ghost} onClick={() => { setForm(null); setError(null); }}>
              Huỷ
            </button>
          </div>
        </form>
      )}
      {!form && error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {entries && entries.length === 0 && <p className="mt-4 text-sm text-muted">Chưa có mốc nào trong dòng thời gian.</p>}
      <ol className="mt-4 space-y-0 border-s-2 border-[var(--color-border)] ps-5">
        {(entries ?? []).map((entry) => {
          const heading = century(entry.year);
          const showHeading = heading !== lastCentury;
          lastCentury = heading;
          return (
            <li key={entry.id} className="relative pb-5">
              {showHeading && <p className="font-display -ms-5 mb-2 text-sm font-bold uppercase tracking-wide text-primary">{heading}</p>}
              <span aria-hidden="true" className="absolute -start-[1.65rem] top-1.5 size-3 rounded-full bg-primary" />
              <p className="text-sm font-semibold text-primary">{formatTimelineDate(entry)}</p>
              <p className="font-display text-base font-bold text-default">{entry.title}</p>
              {entry.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-default">{entry.body}</p>}
              {entry.member_id !== null && (
                <p className="text-xs text-muted">
                  Liên quan:{' '}
                  <Link href={focusHref(entry.member_id)} className="text-primary underline">
                    {entry.member_name}
                  </Link>
                </p>
              )}
              {isAdmin && (
                <div className="flex">
                  <button type="button" className={ghost} onClick={() => setForm({ id: entry.id, values: timelineToForm(entry), person: entry.member_name })}>
                    Sửa
                  </button>
                  <button type="button" className={danger} onClick={() => void remove(entry)}>
                    Xoá
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function WordsTab({ isAdmin, onUnauthorized }: { isAdmin: boolean; onUnauthorized: () => void }) {
  const [words, setWords] = useState<GenerationWord[] | null>(null);
  const [rows, setRows] = useState<WordRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    getJson<GenerationWord[]>('/api/generation-poem', onUnauthorized).then(setWords);
  }, [onUnauthorized]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!rows) return;
    const result = wordsPayload(rows);
    if (!result.ok) return setError(result.error);
    const response = await fetch('/api/generation-poem', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.payload),
    });
    if (!response.ok) return setError(chroniclesErrorMessage(response.status));
    setWords((await response.json()) as GenerationWord[]);
    setRows(null);
    setError(null);
    setSaved(true);
  }

  return (
    <section aria-label="Bài đệm">
      <p className="text-sm text-muted">Bài đệm (tự bối) quy định chữ đệm của từng đời. Khi thêm con, quản trị viên được gợi ý chữ đệm của đời đó.</p>
      {words && words.length === 0 && !rows && <p className="mt-3 text-sm text-muted">Chưa nhập bài đệm.</p>}
      {words && !rows && (
        <ul className="mt-3 divide-y divide-[var(--color-border)] rounded-xl border-default border bg-surface">
          {words.map((w) => (
            <li key={w.generation} className="flex items-baseline gap-x-3 px-4 py-2 text-sm">
              <span className="w-16 shrink-0 text-muted">Đời {w.generation}</span>
              <span className="font-display text-base font-bold text-default">{w.word}</span>
              {w.meaning && <span className="text-muted">{w.meaning}</span>}
            </li>
          ))}
        </ul>
      )}
      {saved && !rows && (
        <p role="status" className="mt-2 text-sm text-muted">
          Đã lưu.
        </p>
      )}
      {isAdmin && !rows && (
        <button type="button" className={`${primary} mt-3`} onClick={() => { setRows(wordsToRows(words ?? []).concat([{ generation: '', word: '', meaning: '' }])); setSaved(false); }}>
          {words && words.length > 0 ? 'Sửa bài đệm' : 'Nhập bài đệm'}
        </button>
      )}
      {rows && (
        <form onSubmit={save} className="mt-3 space-y-2 rounded-xl border-default border bg-surface p-4" aria-label="Biểu mẫu bài đệm">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[4rem_1fr_1.5fr] gap-2">
              <input inputMode="numeric" value={row.generation} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, generation: e.target.value } : r)))} aria-label={`Đời (dòng ${i + 1})`} placeholder="Đời" className={field} />
              <input value={row.word} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, word: e.target.value } : r)))} aria-label={`Chữ đệm (dòng ${i + 1})`} placeholder="Chữ đệm" maxLength={60} className={field} />
              <input value={row.meaning} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, meaning: e.target.value } : r)))} aria-label={`Ý nghĩa (dòng ${i + 1})`} placeholder="Ý nghĩa (tuỳ chọn)" className={field} />
            </div>
          ))}
          <button type="button" className={ghost} onClick={() => setRows([...rows, { generation: String(Number(rows[rows.length - 1]?.generation || 0) + 1), word: '', meaning: '' }])}>
            + Thêm dòng
          </button>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-x-2">
            <button type="submit" className={primary}>
              Lưu bài đệm
            </button>
            <button type="button" className={ghost} onClick={() => { setRows(null); setError(null); }}>
              Huỷ
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
