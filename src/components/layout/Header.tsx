'use client';

import Link from 'next/link';
import { NotificationsBell } from '@/components/layout/NotificationsBell';
import { HeaderIconButton, SignOutIcon } from '@/components/layout/HeaderIconButton';
import { TreeSwitcher } from '@/components/layout/TreeSwitcher';
import { ThemeSettingsPopover } from '@/components/theme/ThemeSettingsPopover';
import { roleLabel, type CurrentUser } from '@/lib/auth/session';
import { myProfileHref } from '@/lib/invites/invites';

export type HeaderSearchResult = {
  key: string;
  label: string;
  /** A smaller line after the name: "đời 3 · con Nguyễn Văn Hai". */
  hint?: string;
  onSelect: () => void;
};

export type HeaderSearch = {
  query: string;
  onQueryChange: (query: string) => void;
  results: HeaderSearchResult[];
};

export type HeaderProps = {
  /** The family's name, the same on every page. */
  familyName: string;
  /** null = a guest browsing a public site. */
  user: CurrentUser | null;
  /** Omit on pages that have nothing to search (e.g. the admin page). */
  search?: HeaderSearch;
  onLogout: () => void;
  /** Opens the navigation drawer; only shown below the md breakpoint, where there is no sidebar. */
  onMenu?: () => void;
};

/**
 * Left: menu button (phone) and the family's name. Middle: the search box, centred. Right: who is signed in (name and role) right next to the
 * icons — notifications, colour theme, sign out. On a phone the search drops to its own row and the name leaves (it is in the menu).
 */
export function Header({ familyName, user, search, onLogout, onMenu }: HeaderProps) {
  return (
    <header className="relative z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-default border-b bg-surface px-4 py-3 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-x-2">
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
        <p className="font-display min-w-0 truncate text-lg font-bold text-primary sm:text-xl">{familyName}</p>
      </div>

      {search ? (
        <div className="relative order-last col-span-2 md:order-none md:col-span-1">
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
                    {result.hint && <span className="text-xs text-muted"> · {result.hint}</span>}
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
      ) : (
        <div className="hidden md:block" />
      )}

      <div className="flex min-w-0 items-center justify-end gap-x-1 sm:gap-x-2">
        <TreeSwitcher user={user} />
        {user &&
          (user.member ? (
            <Link
              href={myProfileHref(user.member.id)}
              prefetch={false}
              title="Hồ sơ của tôi"
              // on the tree page itself the address only changes the query, which the tree reads once: reload to focus
              onClick={(event) => {
                if (window.location.pathname === '/') {
                  event.preventDefault();
                  window.location.assign(myProfileHref(user.member!.id));
                }
              }}
              className="hidden min-w-0 rounded-lg px-2 py-1 text-right leading-tight hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] xl:block"
            >
              <span className="block truncate text-sm font-medium text-default underline">{user.full_name}</span>
              <span className="block truncate text-xs text-muted">Hồ sơ của tôi · {roleLabel(user.role)}</span>
            </Link>
          ) : (
            <div className="hidden min-w-0 px-2 text-right leading-tight xl:block">
              <p className="truncate text-sm font-medium text-default">{user.full_name}</p>
              <p className="truncate text-xs text-muted">{roleLabel(user.role)}</p>
            </div>
          ))}
        <NotificationsBell user={user} />
        <ThemeSettingsPopover />
        {user ? (
          <HeaderIconButton label="Đăng xuất" onClick={onLogout}>
            <SignOutIcon />
          </HeaderIconButton>
        ) : (
          <Link
            href="/login"
            className="flex min-h-11 items-center whitespace-nowrap rounded-lg px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            Đăng nhập
          </Link>
        )}
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
