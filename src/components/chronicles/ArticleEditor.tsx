'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RichTextEditorHandle } from '@/components/chronicles/RichTextEditor';
import { PersonPicker } from '@/components/common/PersonPicker';
import { UploadButton } from '@/components/media/UploadButton';
import { MarkdownView, type MediaUrls } from '@/components/markdown/MarkdownView';
import {
  ARTICLE_KIND_LABELS,
  articlePayload,
  articleToForm,
  chroniclesErrorMessage,
  EMPTY_ARTICLE_FORM,
  type Article,
  type ArticleForm,
  type ArticleKind,
  type MemberName,
} from '@/lib/chronicles/chronicles';
import { mediaErrorMessage, uploadProblem, type MediaItem } from '@/lib/media/media';

// The editor (Tiptap/ProseMirror) is heavy and only the edit pages need it, so it loads on demand.
const RichTextEditor = dynamic(() => import('@/components/chronicles/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="min-h-[24rem] rounded-lg border-default border bg-surface" aria-busy="true" aria-label="Đang tải trình soạn thảo" />,
});

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

/** Writing surface like a word processor (the article is still stored as Markdown), with a preview of the reader's view. Photos need the article to exist, so a new one is saved first (as a draft). */
export function ArticleEditor({
  article,
  onDone,
  onCancel,
}: {
  article: Article | null;
  /** Called after a save (with the saved article) or a delete (with null). */
  onDone: (saved: Article | null) => void;
  onCancel: () => void;
}) {
  const [saved, setSaved] = useState<Article | null>(article);
  const [form, setForm] = useState<ArticleForm>(article ? articleToForm(article) : EMPTY_ARTICLE_FORM);
  const [people, setPeople] = useState<MemberName[]>(article?.members ?? []);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMedia = useCallback(async (id: number) => {
    const response = await fetch(`/api/articles/${id}/media`, { credentials: 'include' });
    if (response.ok) setMedia((await response.json()) as MediaItem[]);
  }, []);

  useEffect(() => {
    if (saved) void loadMedia(saved.id);
  }, [saved, loadMedia]);

  const mediaUrls: MediaUrls = useMemo(() => new Map(media.map((m) => [m.id, { url: m.url, thumb: m.thumb_url }])), [media]);
  const set = <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(): Promise<Article | null> {
    const result = articlePayload({ ...form, member_ids: people.map((p) => p.id) });
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(saved ? `/api/articles/${saved.id}` : '/api/articles', {
        method: saved ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.payload),
      });
      if (!response.ok) {
        setError(chroniclesErrorMessage(response.status));
        return null;
      }
      const next = (await response.json()) as Article;
      setSaved(next);
      return next;
    } catch {
      setError('Không thể kết nối tới máy chủ.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    const target = saved ?? (await save());
    if (!target) return;
    setError(null);
    setUploading(true);
    for (const file of files) {
      const problem = uploadProblem(file);
      if (problem) {
        setError(problem);
        continue;
      }
      const data = new FormData();
      data.append('file', file);
      const response = await fetch(`/api/articles/${target.id}/media`, { method: 'POST', credentials: 'include', body: data });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setError(`${file.name}: ${mediaErrorMessage(response.status, (body as { detail?: unknown } | null)?.detail)}`);
      }
    }
    await loadMedia(target.id);
    setUploading(false);
  }

  function insert(item: MediaItem) {
    setPreviewing(false);
    editorRef.current?.insertImage({ id: item.id, url: item.url, caption: item.caption ?? '' });
  }

  const photos = useMemo(
    () => media.filter((m) => m.kind === 'image').map((m) => ({ id: m.id, url: m.thumb_url ?? m.url, caption: m.caption ?? '' })),
    [media]
  );

  async function remove() {
    if (!saved || !window.confirm(`Xoá bài “${saved.title}”? Ảnh của bài cũng bị xoá.`)) return;
    const response = await fetch(`/api/articles/${saved.id}`, { method: 'DELETE', credentials: 'include' });
    if (response.ok) onDone(null);
    else setError(chroniclesErrorMessage(response.status));
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const next = await save();
        if (next) onDone(next);
      }}
      className="space-y-4"
      aria-label="Soạn bài"
    >
      <h2 className="font-display text-xl font-bold text-default">{saved ? 'Sửa bài' : 'Bài mới'}</h2>
      <label className="block text-sm">
        <span className="text-xs text-muted">Tiêu đề</span>
        <input required value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} aria-label="Tiêu đề" className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-xs text-muted">Loại</span>
          <select value={form.kind} onChange={(e) => set('kind', e.target.value as ArticleKind)} aria-label="Loại bài" className={field}>
            {(Object.keys(ARTICLE_KIND_LABELS) as ArticleKind[]).map((k) => (
              <option key={k} value={k}>
                {ARTICLE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">Trạng thái</span>
          <select value={form.status} onChange={(e) => set('status', e.target.value as ArticleForm['status'])} aria-label="Trạng thái bài" className={field}>
            <option value="draft">Bản nháp (chỉ quản trị viên thấy)</option>
            <option value="published">Đã đăng</option>
          </select>
        </label>
        <label className="flex min-h-11 items-end gap-x-2 pb-2 text-sm text-default">
          <input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} />
          Ghim lên đầu
        </label>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-default">Nội dung</span>
          <button type="button" aria-pressed={previewing} onClick={() => setPreviewing((v) => !v)} className={ghost}>
            {previewing ? 'Quay lại soạn thảo' : 'Xem trước'}
          </button>
        </div>
        {notice && (
          <p role="status" className="mt-1 rounded-lg bg-surface-muted px-3 py-2 text-sm text-default">
            {notice}
          </p>
        )}
        <div className="mt-1">
          {/* kept mounted while previewing so nothing typed is lost */}
          <div hidden={previewing}>
            <RichTextEditor ref={editorRef} value={form.body} onChange={(markdown) => set('body', markdown)} photos={photos} onNotice={setNotice} />
          </div>
          {previewing && (
            <div className="min-h-[24rem] overflow-y-auto rounded-lg border-default border bg-surface p-4" aria-label="Xem trước bài">
              <MarkdownView source={form.body || '*Chưa có nội dung.*'} media={mediaUrls} />
            </div>
          )}
        </div>
      </div>

      <section aria-label="Ảnh của bài" className="rounded-xl border-default border bg-surface p-4">
        <h3 className="text-sm font-semibold text-default">Ảnh của bài</h3>
        <p className="mt-1 text-xs text-muted">Tải ảnh lên (bài mới sẽ được lưu nháp trước), rồi bấm “Chèn” hoặc nút ảnh trên thanh công cụ để đưa vào chỗ con trỏ, hoặc chọn làm ảnh bìa.</p>
        <div className="mt-2">
          <UploadButton accept="image/jpeg,image/png,image/webp" label="Thêm ảnh cho bài" hint="Ảnh JPEG, PNG hoặc WebP, tối đa 10 MB mỗi ảnh." busy={uploading} onFiles={(files) => void upload(files)} />
        </div>
        {media.length > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media
              .filter((m) => m.kind === 'image')
              .map((m) => (
                <li key={m.id} className="min-w-0 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.thumb_url ?? m.url} alt={m.caption ?? m.original_name} className="aspect-square w-full rounded-lg object-cover" />
                  <div className="mt-1 flex flex-wrap items-center">
                    <button type="button" className={ghost} onClick={() => insert(m)}>
                      Chèn
                    </button>
                    <button type="button" className={ghost} aria-pressed={form.cover_media_id === m.id} onClick={() => set('cover_media_id', form.cover_media_id === m.id ? null : m.id)}>
                      {form.cover_media_id === m.id ? '★ Ảnh bìa' : 'Làm ảnh bìa'}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section aria-label="Người được nhắc tới" className="rounded-xl border-default border bg-surface p-4">
        <h3 className="text-sm font-semibold text-default">Người được nhắc tới</h3>
        <p className="mt-1 text-xs text-muted">Hồ sơ của họ sẽ hiện “Được nhắc trong…” kèm bài này.</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center rounded-full bg-surface-muted ps-3 text-sm text-default">
              {p.name}
              <button type="button" aria-label={`Bỏ ${p.name}`} className="min-h-9 px-2 text-muted hover:text-danger" onClick={() => setPeople((list) => list.filter((x) => x.id !== p.id))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <PersonPicker label="Thêm người được nhắc" excludeIds={people.map((p) => p.id)} onPick={(p) => setPeople((list) => [...list, p])} />
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-2">
        <button type="submit" className={primary} disabled={busy}>
          Lưu bài
        </button>
        <button type="button" className={ghost} onClick={onCancel}>
          Đóng
        </button>
        {saved && (
          <button type="button" className={danger} onClick={() => void remove()}>
            Xoá bài
          </button>
        )}
      </div>
    </form>
  );
}
