import type { ReactNode } from 'react';

/** The look shared by the header's icon actions (bell, settings, sign-out): 44px target, no border. */
export const HEADER_ICON_BUTTON_CLASS =
  'relative flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';

export function HeaderIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={HEADER_ICON_BUTTON_CLASS}>
      {children}
    </button>
  );
}

export function SignOutIcon() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
