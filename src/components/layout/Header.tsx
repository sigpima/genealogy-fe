'use client';

import Link from 'next/link';
import { NotificationsBell } from '@/components/layout/NotificationsBell';
import { HeaderIconButton, SignOutIcon } from '@/components/layout/HeaderIconButton';
import { TreeSwitcher } from '@/components/layout/TreeSwitcher';
import { ThemeSettingsPopover } from '@/components/theme/ThemeSettingsPopover';
import { roleLabel, type CurrentUser } from '@/lib/auth/session';

export type HeaderSearchResult = {
  key: string;
  label: string;
  onSelect: () => void;
};

export type HeaderSearch = {
  query: string;
  onQueryChange: (query: string) => void;
  results: HeaderSearchResult[];
};

export type HeaderProps = {
  clanName: string;
  /** null = a guest browsing a public site. */
  user: CurrentUser | null;
  /** Omit on pages that have nothing to search (e.g. the admin page). */
  search?: HeaderSearch;
  onLogout: () => void;
  /** Opens the navigation drawer; only shown below the md breakpoint, where there is no sidebar. */
  onMenu?: () => void;
};

export function Header({ clanName, user, search, onLogout, onMenu }: HeaderProps) {
  return (
    <header className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-default border-b bg-surface px-4 py-3 sm:flex-nowrap sm:gap-x-6 sm:px-6">
      {onMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Mở menu"
          className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] md:hidden"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      <h1 className="font-display shrink-0 truncate text-lg font-bold text-primary sm:text-xl">
        {clanName}
      </h1>
      {user && (
        <div className="hidden min-w-0 leading-tight md:block">
          <p className="max-w-48 truncate text-sm font-medium text-default">{user.full_name}</p>
          <p className="text-xs text-muted">{roleLabel(user.role)}</p>
        </div>
      )}
      {search && (
        <div className="relative order-last basis-full sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto sm:max-w-sm">
          <SearchIcon />
          <input
            type="search"
            value={search.query}
            onChange={(e) => search.onQueryChange(e.target.value)}
            placeholder="Tìm theo tên..."
            aria-label="Tìm thành viên theo tên"
            className="h-11 w-full rounded-lg border-default border bg-app ps-9 pe-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]"
          />
          {search.query.trim() && (
            <ul className="shadow-float absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border-default border bg-surface">
              {search.results.length === 0 && <li className="px-3 py-2 text-sm text-muted">Không có kết quả khớp tên.</li>}
              {search.results.map((result) => (
                <li key={result.key}>
                  <button
                    type="button"
                    onClick={result.onSelect}
                    className="block min-h-11 w-full px-3 py-2 text-left text-sm text-default hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  >
                    {result.label}
                  </button>
                </li>
              ))}
              <li className="border-default border-t">
                <Link
                  href={`/tim-kiem?q=${encodeURIComponent(search.query.trim())}`}
                  className="block min-h-11 px-3 py-3 text-sm font-medium text-primary hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                >
                  Tìm nâng cao “{search.query.trim()}” (cả vợ/chồng, bộ lọc)
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
      <div className="ml-auto flex items-center gap-x-1 sm:gap-x-2">
        <TreeSwitcher user={user} />
        <NotificationsBell user={user} />
        {user ? (
          <>
            <ThemeSettingsPopover />
            <HeaderIconButton label="Đăng xuất" onClick={onLogout}>
              <SignOutIcon />
            </HeaderIconButton>
          </>
        ) : (
          <Link
            href="/login"
            className="flex min-h-11 items-center whitespace-nowrap rounded-lg px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            Đăng nhập
          </Link>
        )}
        {!user && <ThemeSettingsPopover />}
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
