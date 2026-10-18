'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import { useRef, useState, type ReactNode } from 'react';

type Item = {
  key: string;
  label: string;
  icon: ReactNode;
  run: () => void;
  active?: boolean;
  disabled?: boolean;
};

const svg = (children: ReactNode) => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICONS = {
  undo: svg(<><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></>),
  redo: svg(<><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></>),
  h2: svg(<><path d="M4 5v14M12 5v14M4 12h8" /><path d="M16 10.5a2.5 2 0 0 1 5 0c0 1.5-2 2.5-5 5.5h5" /></>),
  h3: svg(<><path d="M4 5v14M12 5v14M4 12h8" /><path d="M16 9.5h4l-2.5 3a2.2 2.2 0 1 1-1.8 3.5" /></>),
  paragraph: svg(<><path d="M13 4v16M17 4v16M13 4H9.5a4 4 0 0 0 0 8H13" /></>),
  bold: svg(<><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></>),
  italic: svg(<><path d="M19 4h-9M14 20H5M15 4 9 20" /></>),
  bullets: svg(<><path d="M9 6h12M9 12h12M9 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>),
  numbers: svg(<><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></>),
  quote: svg(<><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h4" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2h4" /></>),
  rule: svg(<><path d="M3 12h18" /><path d="M8 7l4-4 4 4M8 17l4 4 4-4" /></>),
  link: svg(<><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></>),
  image: svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>),
};

/** Icon toolbar of the chronicle editor: every button has a name, toggles say whether they are on (`aria-pressed`), and the arrow keys move along it. */
export function EditorToolbar({ editor, onLink, onImage }: { editor: Editor; onLink: () => void; onImage: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      paragraph: e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList') && !e.isActive('blockquote'),
      bullets: e.isActive('bulletList'),
      numbers: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const groups: Item[][] = [
    [
      { key: 'undo', label: 'Hoàn tác', icon: ICONS.undo, run: () => chain().undo().run(), disabled: !state.canUndo },
      { key: 'redo', label: 'Làm lại', icon: ICONS.redo, run: () => chain().redo().run(), disabled: !state.canRedo },
    ],
    [
      { key: 'h2', label: 'Tiêu đề lớn', icon: ICONS.h2, run: () => chain().toggleHeading({ level: 2 }).run(), active: state.h2 },
      { key: 'h3', label: 'Tiêu đề nhỏ', icon: ICONS.h3, run: () => chain().toggleHeading({ level: 3 }).run(), active: state.h3 },
      { key: 'p', label: 'Đoạn văn thường', icon: ICONS.paragraph, run: () => chain().setParagraph().run(), active: state.paragraph },
    ],
    [
      { key: 'bold', label: 'In đậm', icon: ICONS.bold, run: () => chain().toggleBold().run(), active: state.bold },
      { key: 'italic', label: 'In nghiêng', icon: ICONS.italic, run: () => chain().toggleItalic().run(), active: state.italic },
    ],
    [
      { key: 'bullets', label: 'Danh sách chấm', icon: ICONS.bullets, run: () => chain().toggleBulletList().run(), active: state.bullets },
      { key: 'numbers', label: 'Danh sách số', icon: ICONS.numbers, run: () => chain().toggleOrderedList().run(), active: state.numbers },
      { key: 'quote', label: 'Trích dẫn', icon: ICONS.quote, run: () => chain().toggleBlockquote().run(), active: state.quote },
      { key: 'rule', label: 'Đường kẻ ngang', icon: ICONS.rule, run: () => chain().setHorizontalRule().run() },
    ],
    [
      { key: 'link', label: 'Chèn link', icon: ICONS.link, run: onLink, active: state.link },
      { key: 'image', label: 'Chèn ảnh', icon: ICONS.image, run: onImage },
    ],
  ];

  const flat = groups.flat();
  const [current, setCurrent] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent) {
    const buttons = [...(box.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = buttons.findIndex((b) => b === document.activeElement);
    const go = (index: number) => {
      const target = buttons[(index + buttons.length) % buttons.length];
      setCurrent(buttons.indexOf(target));
      target.focus();
    };
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(at + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(at - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      go(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      go(buttons.length - 1);
    }
  }

  let index = -1;
  return (
    <div
      ref={box}
      role="toolbar"
      aria-label="Định dạng bài viết"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-x-1 gap-y-1 rounded-t-lg border-default border-b bg-surface px-2 py-1"
    >
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} role="group" className={`flex items-center gap-x-1 ${groupIndex > 0 ? 'border-default border-s ps-1' : ''}`}>
          {group.map((item) => {
            index += 1;
            const i = index;
            return (
              <button
                key={item.key}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={item.active === undefined ? undefined : item.active}
                disabled={item.disabled}
                tabIndex={i === Math.min(current, flat.length - 1) ? 0 : -1}
                onFocus={() => setCurrent(i)}
                onMouseDown={(event) => event.preventDefault()} // keep the text selection in the editor
                onClick={item.run}
                className={`flex size-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 ${
                  item.active ? 'bg-primary text-on-primary' : 'text-default hover:bg-surface-muted'
                }`}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
