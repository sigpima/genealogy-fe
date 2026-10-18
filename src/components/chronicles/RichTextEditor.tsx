'use client';

import { Blockquote } from '@tiptap/extension-blockquote';
import Image from '@tiptap/extension-image';
import { ListItem } from '@tiptap/extension-list';
import { mergeAttributes } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { EditorToolbar } from '@/components/chronicles/EditorToolbar';
import { ImagePickerDialog, type EditorPhoto } from '@/components/chronicles/ImagePickerDialog';
import { LinkDialog } from '@/components/chronicles/LinkDialog';
import { safeHref } from '@/lib/markdown/markdown';
import { docToMarkdown, markdownToDoc, unsupportedPresent } from '@/lib/chronicles/richText';

export type RichTextEditorHandle = { insertImage: (photo: EditorPhoto) => void };

type Props = {
  /** The article body, Markdown. Read once when the editor opens (key the component by article). */
  value: string;
  onChange: (markdown: string) => void;
  /** The photos uploaded to this article: what "Chèn ảnh" offers and what `media:ID` pictures show. */
  photos: EditorPhoto[];
  /** Said once when the body holds something the editor can only show as plain text. */
  onNotice?: (message: string) => void;
  ref?: Ref<RichTextEditorHandle>;
};

const OLD_FORMAT_NOTICE = 'Một số định dạng cũ được hiển thị như văn bản thường.';

/**
 * The editor only offers what the reader and the book understand (headings, paragraphs, flat lists, quotes, rules, bold, italic,
 * code, links, photos), so nothing can be typed that would not survive being saved as Markdown.
 */
export default function RichTextEditor({ value, onChange, photos, onNotice, ref }: Props) {
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const [dialog, setDialog] = useState<'link' | 'image' | null>(null);

  const [MediaImage] = useState(() =>
    Image.extend({
      renderHTML({ node, HTMLAttributes }) {
        const src = String(node.attrs.src ?? '');
        const id = /^media:(\d+)$/.exec(src)?.[1];
        const photo = id ? photosRef.current.find((p) => p.id === Number(id)) : undefined;
        return ['img', mergeAttributes(HTMLAttributes, { src: photo?.url ?? '', 'data-media': src, class: 'rich-image', alt: String(node.attrs.alt ?? '') })];
      },
    }).configure({ inline: true, allowBase64: false })
  );

  const editor = useEditor({
    immediatelyRender: false,
    content: markdownToDoc(value),
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        listItem: false,
        blockquote: false,
        hardBreak: false,
        codeBlock: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: false, linkOnPaste: true, isAllowedUri: (url) => safeHref(url) !== null, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      ListItem.extend({ content: 'paragraph' }), // the reader has flat lists
      Blockquote.extend({ content: 'paragraph+' }), // ... and quotes of plain text
      MediaImage,
    ],
    editorProps: { attributes: { class: 'rich-content', 'aria-label': 'Nội dung bài', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => onChange(docToMarkdown(e.getJSON())),
  });

  useEffect(() => {
    if (unsupportedPresent(value)) onNotice?.(OLD_FORMAT_NOTICE);
    // once, when the editor opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // photos arrive after the editor: pictures drawn before their address was known are drawn again (the cursor stays where it was)
  useEffect(() => {
    if (!editor) return;
    const waiting = [...editor.view.dom.querySelectorAll('img[data-media]')].some((img) => !img.getAttribute('src'));
    if (!waiting || photos.length === 0) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(editor.getJSON(), { emitUpdate: false });
    editor.commands.setTextSelection({ from: Math.min(from, editor.state.doc.content.size), to: Math.min(to, editor.state.doc.content.size) });
  }, [editor, photos]);

  useImperativeHandle(
    ref,
    () => ({
      insertImage: (photo) => {
        editor?.chain().focus().insertContent({ type: 'image', attrs: { src: `media:${photo.id}`, alt: photo.caption } }).run();
      },
    }),
    [editor],
  );

  if (!editor) return <div className="min-h-[24rem] rounded-lg border-default border bg-surface" aria-busy="true" />;

  const selection = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(selection.from, selection.to, ' ');
  const currentHref = (editor.getAttributes('link').href as string | undefined) ?? '';

  return (
    <div className="rounded-lg border-default border bg-surface">
      <EditorToolbar editor={editor} onLink={() => setDialog('link')} onImage={() => setDialog('image')} />
      <EditorContent editor={editor} />
      {dialog === 'link' && (
        <LinkDialog
          initialHref={currentHref}
          initialText={selectedText}
          textEditable={selection.empty}
          onCancel={() => setDialog(null)}
          onRemove={currentHref ? () => (editor.chain().focus().extendMarkRange('link').unsetLink().run(), setDialog(null)) : undefined}
          onApply={(href, text) => {
            const chain = editor.chain().focus();
            if (selection.empty && !currentHref) chain.insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run();
            else chain.extendMarkRange('link').setLink({ href }).run();
            setDialog(null);
          }}
        />
      )}
      {dialog === 'image' && (
        <ImagePickerDialog
          photos={photos}
          onCancel={() => setDialog(null)}
          onPick={(photo) => {
            editor.chain().focus().insertContent({ type: 'image', attrs: { src: `media:${photo.id}`, alt: photo.caption } }).run();
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
