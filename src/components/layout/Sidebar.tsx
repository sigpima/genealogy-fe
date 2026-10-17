import Link from 'next/link';

export type SidebarProps = {
  active: 'tree' | 'data' | 'admin';
  isAdmin: boolean;
};

export default function Sidebar({ active, isAdmin }: SidebarProps) {
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
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  current: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? 'page' : undefined}
        aria-label={label}
        className={`flex min-h-11 items-center justify-center gap-x-3 rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] lg:justify-start ${
          current
            ? 'bg-surface-muted font-medium text-primary'
            : 'text-default hover:bg-surface-muted'
        }`}
      >
        {icon}
        <span className="hidden lg:inline">{label}</span>
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
