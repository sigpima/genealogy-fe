'use client';

import { useRef, useState } from 'react';
import { useDismiss } from '@/components/common/useDismiss';
import { THEMES } from '@/lib/theme/themes';
import { headerIconClass } from '@/components/layout/HeaderIconButton';
import { useTheme } from './ThemeProvider';

export function ThemeSettingsPopover() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, open, () => setOpen(false));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Đổi giao diện màu"
        title="Đổi giao diện màu"
        aria-expanded={open}
        className={headerIconClass(open)}
      >
        <PaletteIcon />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border-default border bg-surface p-2 shadow-md">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setTheme(option.id);
                setOpen(false);
              }}
              className={`flex min-h-11 w-full items-center gap-x-3 rounded-lg px-3 py-2 text-left text-sm text-default hover:bg-surface-muted ${
                theme === option.id ? 'bg-highlight font-semibold' : ''
              }`}
            >
              <span
                className="size-4 rounded-full border-default border"
                style={{ backgroundColor: option.swatch.bg }}
              />
              <span className="size-4 rounded-full" style={{ backgroundColor: option.swatch.primary }} />
              <span>{option.label}</span>
              {theme === option.id && <span className="ml-auto text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaletteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-3.9-4-7.2-9-7.2z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="14.5" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}
