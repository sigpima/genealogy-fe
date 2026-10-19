import Link from 'next/link';

const iconSvg = (children: React.ReactNode) => (
  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
export const ACTION_ICONS = {
  history: iconSvg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  edit: iconSvg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>),
  invite: iconSvg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
};

/** One of the panel's top actions: the icon centred above its name, all of them side by side. */
export function ActionTile({ label, icon, onClick, href }: { label: string; icon: React.ReactNode; onClick?: () => void; href?: string }) {
  const className =
    'flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-y-1 rounded-xl border-default border bg-surface px-2 py-2 text-center text-sm font-medium text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
  const content = (
    <>
      {icon}
      <span className="leading-tight">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

/** A titled block of the profile: the same bold header everywhere and a clear line between blocks. */
export function PanelSection({ title, label, first = false, children }: { title: string; label?: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={label ?? title} className={first ? '' : 'mt-6 border-t border-[var(--color-border)] pt-5'}>
      <h3 className="font-display border-s-4 border-[var(--color-accent)] ps-2 text-base font-bold text-default">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-x-3">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-default">{value}</dd>
    </div>
  );
}

export function AvatarOrInitial({ src, initial, size }: { src: string | null; initial: string; size: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="font-display flex items-center justify-center rounded-full bg-primary text-on-primary"
    >
      {initial.toUpperCase() || '?'}
    </div>
  );
}
