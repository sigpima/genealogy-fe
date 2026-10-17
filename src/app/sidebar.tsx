import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="hidden w-16 shrink-0 flex-col border-default border-e bg-surface md:flex lg:w-60">
      <nav aria-label="Điều hướng chính" className="flex-1 px-2 pt-4">
        <ul className="space-y-1">
          <li>
            <Link
              href="/"
              aria-current="page"
              aria-label="Cây Gia Phả"
              className="flex min-h-11 items-center justify-center gap-x-3 rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] lg:justify-start"
            >
              <TreeIcon />
              <span className="hidden lg:inline">Cây Gia Phả</span>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

function TreeIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-4h12v4" />
    </svg>
  );
}
