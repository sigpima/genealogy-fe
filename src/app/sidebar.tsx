import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-default border-e bg-surface lg:flex">
      <div className="flex items-center gap-x-2 px-4 py-4">
        <span className="text-lg font-semibold text-default">Gia Phả</span>
      </div>
      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          <li>
            <Link
              href="/"
              className="flex min-h-9 items-center gap-x-3 rounded-lg bg-app px-3 py-2 text-sm text-default"
            >
              Cây gia phả
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
