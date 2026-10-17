'use client';

import { ThemeSettingsPopover } from '@/components/theme/ThemeSettingsPopover';

export type HeaderSearchResult = {
  key: string;
  label: string;
  onSelect: () => void;
};

export type HeaderProps = {
  clanName: string;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: HeaderSearchResult[];
  onLogout: () => void;
};

export function Header({ clanName, searchQuery, onSearchQueryChange, searchResults, onLogout }: HeaderProps) {
  return (
    <header className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap border-default border-b bg-surface px-4 py-3 sm:gap-x-6 sm:px-6">
      <h1 className="font-display shrink-0 truncate text-lg font-bold text-primary sm:text-xl">{clanName}</h1>
      <div className="relative order-last basis-full sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto sm:max-w-sm">
        <SearchIcon />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Tìm theo tên..."
          aria-label="Tìm thành viên theo tên"
          className="h-10 w-full rounded-lg border-default border bg-app ps-9 pe-3 text-sm text-default placeholder:text-muted focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(197,155,39,0.2)]"
        />
        {searchQuery && searchResults.length > 0 && (
          <ul className="shadow-float absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border-default border bg-surface">
            {searchResults.map((result) => (
              <li key={result.key}>
                <button
                  type="button"
                  onClick={result.onSelect}
                  className="block min-h-11 w-full px-3 py-2 text-left text-sm text-default hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ml-auto flex items-center gap-x-3">
        <button
          type="button"
          onClick={onLogout}
          className="min-h-11 whitespace-nowrap rounded-lg px-2 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
        >
          Đăng xuất
        </button>
        <ThemeSettingsPopover />
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
