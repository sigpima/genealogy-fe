'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MarkdownView, type MediaUrls } from '@/components/markdown/MarkdownView';
import { ARTICLE_KIND_LABELS, type Article } from '@/lib/chronicles/chronicles';
import type { MediaItem } from '@/lib/media/media';
import { focusHref } from '@/lib/search/search';

/** One article, read-only. A guest sees the text; photos are for signed-in readers (they degrade to their caption). */
export function ArticleReader({ slug, isAdmin, signedIn, onUnauthorized }: { slug: string; isAdmin: boolean; signedIn: boolean; onUnauthorized: () => void }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/articles/by-slug/${encodeURIComponent(slug)}`, { credentials: 'include' });
        if (response.status === 401) return onUnauthorized();
        if (!response.ok) return !cancelled && setState('missing');
        const body = (await response.json()) as Article;
        if (cancelled) return;
        setArticle(body);
        setState('ok');
        if (signedIn) {
          const files = await fetch(`/api/articles/${body.id}/media`, { credentials: 'include' });
          if (files.ok && !cancelled) setMedia((await files.json()) as MediaItem[]);
        }
      } catch {
        if (!cancelled) setState('missing');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, signedIn, onUnauthorized]);

  const mediaUrls: MediaUrls | null = useMemo(() => (signedIn ? new Map(media.map((m) => [m.id, { url: m.url, thumb: m.thumb_url }])) : null), [media, signedIn]);

  if (state === 'loading') return <p className="px-6 py-8 text-sm text-muted">Đang tải...</p>;
  if (state === 'missing' || !article) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-muted">Không tìm thấy bài viết này (có thể đã bị xoá hoặc chưa được đăng).</p>
        <Link href="/su-ky" className="mt-3 inline-block text-sm font-medium text-primary underline">
          ← Về Sử ký
        </Link>
      </div>
    );
  }
  return (
    <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6" aria-label={article.title}>
      <Link href="/su-ky" className="text-sm text-muted hover:text-default">
        ← Sử ký
      </Link>
      {article.cover_url && signedIn && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.cover_url} alt="" className="mt-4 max-h-72 w-full rounded-xl object-cover" />
      )}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
        {ARTICLE_KIND_LABELS[article.kind]}
        {article.status === 'draft' && ' · bản nháp'}
      </p>
      <h1 className="font-display mt-1 text-3xl font-bold text-default">{article.title}</h1>
      {isAdmin && (
        <Link href={`/su-ky?sua=${article.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary underline">
          Sửa bài
        </Link>
      )}
      <div className="mt-5">
        <MarkdownView source={article.body} media={mediaUrls} />
      </div>
      {article.members.length > 0 && (
        <section className="mt-8 border-default border-t pt-4" aria-label="Người được nhắc tới">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Được nhắc tới</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {article.members.map((m) => (
              <li key={m.id}>
                <Link href={focusHref(m.id)} className="inline-flex min-h-11 items-center rounded-full bg-surface-muted px-3 text-sm text-primary hover:underline">
                  {m.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
