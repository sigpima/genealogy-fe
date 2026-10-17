import Link from 'next/link';
import type { Block, Inline } from '@/lib/markdown/markdown';
import { parseMarkdown } from '@/lib/markdown/markdown';

export type MediaUrls = Map<number, { url: string; thumb: string | null }>;

/**
 * Renders the Markdown subset as React elements (never as HTML). `media` maps `media:ID` to files: it is null for a guest,
 * who is not allowed to fetch photos, so an image degrades to its caption.
 */
export function MarkdownView({ source, media }: { source: string; media: MediaUrls | null }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="space-y-4 text-[15px] leading-7 text-default">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} media={media} />
      ))}
    </div>
  );
}

function BlockView({ block, media }: { block: Block; media: MediaUrls | null }) {
  switch (block.type) {
    case 'heading': {
      const sizes = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-lg', 4: 'text-base' } as const;
      const Tag = `h${Math.min(block.level + 1, 6)}` as 'h2' | 'h3' | 'h4' | 'h5'; // the page title is the h1
      return (
        <Tag className={`font-display font-bold text-default ${sizes[block.level]}`}>
          <Inlines nodes={block.children} media={media} />
        </Tag>
      );
    }
    case 'paragraph': {
      const only = block.children.length === 1 ? block.children[0] : null;
      if (only?.type === 'image') return <Figure node={only} media={media} />;
      return (
        <p>
          <Inlines nodes={block.children} media={media} />
        </p>
      );
    }
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className={`space-y-1 ps-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines nodes={item} media={media} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote className="font-display border-s-4 border-[var(--color-accent)] ps-4 italic text-muted">
          <Inlines nodes={block.children} media={media} />
        </blockquote>
      );
    case 'rule':
      return <hr className="border-default" />;
  }
}

function Figure({ node, media }: { node: Extract<Inline, { type: 'image' }>; media: MediaUrls | null }) {
  const file = media?.get(node.mediaId);
  if (!file) return node.alt ? <p className="text-sm italic text-muted">[{node.alt}]</p> : null;
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file.url} alt={node.alt} loading="lazy" className="max-h-[32rem] w-full rounded-lg object-contain" />
      {node.alt && <figcaption className="mt-1 text-center text-xs text-muted">{node.alt}</figcaption>}
    </figure>
  );
}

function Inlines({ nodes, media }: { nodes: Inline[]; media: MediaUrls | null }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return <span key={i}>{node.text}</span>;
          case 'strong':
            return (
              <strong key={i} className="font-semibold">
                <Inlines nodes={node.children} media={media} />
              </strong>
            );
          case 'em':
            return (
              <em key={i}>
                <Inlines nodes={node.children} media={media} />
              </em>
            );
          case 'code':
            return (
              <code key={i} className="rounded bg-surface-muted px-1 py-0.5 text-[0.9em]">
                {node.text}
              </code>
            );
          case 'link': {
            const external = /^(https?:|mailto:)/i.test(node.href);
            const children = <Inlines nodes={node.children} media={media} />;
            return external ? (
              <a key={i} href={node.href} target="_blank" rel="noreferrer noopener" className="text-primary underline">
                {children}
              </a>
            ) : (
              <Link key={i} href={node.href} className="text-primary underline">
                {children}
              </Link>
            );
          }
          case 'image':
            return <Figure key={i} node={node} media={media} />;
        }
      })}
    </>
  );
}
