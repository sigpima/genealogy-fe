'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export type NavId =
  | 'tree'
  | 'chronicles'
  | 'search'
  | 'branches'
  | 'stats'
  | 'calendar'
  | 'places'
  | 'requests'
  | 'audit'
  | 'data'
  | 'export'
  | 'admin'
  | 'platform';

export type SidebarProps = {
  active: NavId;
  isAdmin: boolean;
  /** The platform owner also gets the page that manages every family. */
  isSuperadmin?: boolean;
  /** Signed-in users get the "Yêu cầu" item (their proposals; admins: the ones to review). */
  signedIn?: boolean;
  /** Phones have no sidebar: the same list opens as a drawer from the header's menu button. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

type Entry = { id: NavId; href: string; label: string; icon: React.ReactNode; show: boolean; badge?: number };

export default function Sidebar({
  active,
  isAdmin,
  isSuperadmin = false,
  signedIn = false,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pending = usePendingRequests(signedIn);
  const entries: Entry[] = [
    { id: 'tree', href: '/', label: 'Cây Gia Phả', icon: <TreeIcon />, show: true },
    { id: 'chronicles', href: '/su-ky', label: 'Sử ký', icon: <BookIcon />, show: true },
    { id: 'search', href: '/tim-kiem', label: 'Tìm kiếm', icon: <SearchNavIcon />, show: true },
    { id: 'branches', href: '/chi-phai', label: 'Chi phái', icon: <BranchesIcon />, show: true },
    { id: 'stats', href: '/thong-ke', label: 'Thống kê', icon: <ChartIcon />, show: true },
    { id: 'calendar', href: '/lich', label: 'Lịch giỗ', icon: <CalendarIcon />, show: true },
    { id: 'places', href: '/dia-diem', label: 'Địa điểm', icon: <PinIcon />, show: signedIn },
    { id: 'requests', href: '/yeu-cau', label: 'Yêu cầu', icon: <InboxIcon />, show: signedIn, badge: pending },
    { id: 'audit', href: '/nhat-ky', label: 'Nhật ký', icon: <HistoryIcon />, show: isAdmin },
    { id: 'data', href: '/nhap-lieu', label: 'Nhập liệu', icon: <TableIcon />, show: isAdmin },
    { id: 'export', href: '/xuat-ban', label: 'Xuất bản', icon: <PrintIcon />, show: isAdmin },
    { id: 'admin', href: '/admin', label: 'Quản trị', icon: <ShieldIcon />, show: isAdmin },
    { id: 'platform', href: '/he-thong', label: 'Các họ', icon: <FamiliesIcon />, show: isSuperadmin },
  ];
  const list = (always: boolean) => (
    <ul className="space-y-1">
      {entries
        .filter((e) => e.show)
        .map((e) => (
          <NavItem key={e.id} href={e.href} label={e.label} icon={e.icon} current={active === e.id} badge={e.badge} alwaysLabel={always} onNavigate={onMobileClose} />
        ))}
    </ul>
  );

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      <aside className="hidden w-16 shrink-0 flex-col border-default border-e bg-surface md:flex lg:w-60">
        <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-2 pt-4">
          {list(false)}
        </nav>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Đóng menu" onClick={onMobileClose} className="absolute inset-0 bg-black/40" />
          <div role="dialog" aria-modal="true" aria-label="Menu" className="shadow-float absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-surface">
            <div className="flex items-center justify-between border-default border-b px-4 py-3">
              <span className="font-display text-lg font-bold text-primary">Gia phả</span>
              <button type="button" onClick={onMobileClose} className="min-h-11 rounded-lg px-3 text-sm text-muted hover:text-default">
                Đóng ✕
              </button>
            </div>
            <nav aria-label="Điều hướng chính (điện thoại)" className="flex-1 overflow-y-auto px-2 pt-3">
              {list(true)}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function NavItem({
  href,
  label,
  icon,
  current,
  badge = 0,
  alwaysLabel = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  current: boolean;
  badge?: number;
  alwaysLabel?: boolean;
  onNavigate?: () => void;
}) {
  const wide = alwaysLabel ? '' : 'justify-center lg:justify-start';
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={current ? 'page' : undefined}
        aria-label={badge > 0 ? `${label} (${badge} đang chờ)` : label}
        className={`relative flex min-h-11 items-center gap-x-3 rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${wide} ${
          current ? 'bg-surface-muted font-semibold text-default' : 'text-default hover:bg-surface-muted'
        }`}
      >
        {icon}
        <span className={alwaysLabel ? '' : 'hidden lg:inline'}>{label}</span>
        {badge > 0 && (
          <span
            className={`min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-on-primary ${
              alwaysLabel ? 'ms-auto' : 'absolute end-1.5 top-1 lg:static lg:ms-auto'
            }`}
          >
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

function PrintIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" />
      <path d="M6.5 17A2.5 2.5 0 0 0 4 19.5V21h16" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 3v18h18" />
      <path d="M8 17v-6M13 17V7M18 17v-3" />
    </svg>
  );
}
