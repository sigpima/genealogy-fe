'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export type SidebarProps = {
  active: 'tree' | 'search' | 'branches' | 'requests' | 'audit' | 'data' | 'admin' | 'platform';
  isAdmin: boolean;
  /** The platform owner also gets the page that manages every family. */
  isSuperadmin?: boolean;
  /** Signed-in users get the "Yêu cầu" item (their proposals; admins: the ones to review). */
  signedIn?: boolean;
};

export default function Sidebar({ active, isAdmin, isSuperadmin = false, signedIn = false }: SidebarProps) {
  const pending = usePendingRequests(signedIn);
  return (
    <aside className="hidden w-16 shrink-0 flex-col border-default border-e bg-surface md:flex lg:w-60">
      <nav aria-label="Điều hướng chính" className="flex-1 px-2 pt-4">
        <ul className="space-y-1">
          <NavItem
            href="/"
            label="Cây Gia Phả"
            icon={<TreeIcon />}
            current={active === 'tree'}
          />
          <NavItem
            href="/tim-kiem"
            label="Tìm kiếm"
            icon={<SearchNavIcon />}
            current={active === 'search'}
          />
          <NavItem
            href="/chi-phai"
            label="Chi phái"
            icon={<BranchesIcon />}
            current={active === 'branches'}
          />
          {signedIn && (
            <NavItem
              href="/yeu-cau"
              label="Yêu cầu"
              icon={<InboxIcon />}
              current={active === 'requests'}
              badge={pending}
            />
          )}
          {isAdmin && (
            <NavItem
              href="/nhat-ky"
              label="Nhật ký"
              icon={<HistoryIcon />}
              current={active === 'audit'}
            />
          )}
          {isAdmin && (
            <NavItem
              href="/nhap-lieu"
              label="Nhập liệu"
              icon={<TableIcon />}
              current={active === 'data'}
            />
          )}
          {isAdmin && (
            <NavItem
              href="/admin"
              label="Quản trị"
              icon={<ShieldIcon />}
              current={active === 'admin'}
            />
          )}
          {isSuperadmin && (
            <NavItem
              href="/he-thong"
              label="Các họ"
              icon={<FamiliesIcon />}
              current={active === 'platform'}
            />
          )}
        </ul>
      </nav>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon,
  current,
  badge = 0,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  current: boolean;
  badge?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? 'page' : undefined}
        aria-label={badge > 0 ? `${label} (${badge} đang chờ)` : label}
        className={`relative flex min-h-11 items-center justify-center gap-x-3 rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] lg:justify-start ${
          current
            ? 'bg-surface-muted font-medium text-primary'
            : 'text-default hover:bg-surface-muted'
        }`}
      >
        {icon}
        <span className="hidden lg:inline">{label}</span>
        {badge > 0 && (
          <span className="absolute end-1.5 top-1 min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-on-primary lg:static lg:ms-auto">
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

const iconProps = {
  'aria-hidden': true,
  xmlns: 'http://www.w3.org/2000/svg',
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function TreeIcon() {
  return (
    <svg {...iconProps}>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-4h12v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </svg>
  );
}

function FamiliesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 21V9l5-4 5 4v12M13 21V13l4-3 4 3v8M2 21h20" />
    </svg>
  );
}

function SearchNavIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BranchesIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="6" cy="19" r="2" />
      <path d="M6 7v10M6 12h10" />
    </svg>
  );
}

/** How many requests wait (admins: all of them; others: their own). A failure just hides the badge. */
function usePendingRequests(signedIn: boolean): number {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch('/api/requests/summary', { credentials: 'include' })
      .then((response) => (response.ok ? (response.json() as Promise<{ pending: number }>) : { pending: 0 }))
      .then((body) => {
        if (!cancelled) setPending(body.pending);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signedIn]);
  return signedIn ? pending : 0;
}

function InboxIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}
