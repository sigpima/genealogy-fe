'use client';

import { ThemeSettingsPopover } from '@/components/theme/ThemeSettingsPopover';

export type HeaderSearchResult = {
  key: string;
  label: string;
  onSelect: () => void;
};

export type HeaderProps = {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: HeaderSearchResult[];
  onLogout: () => void;
};

export function Header({ searchQuery, onSearchQueryChange, searchResults, onLogout }: HeaderProps) {
  return (
    <header className="relative flex items-center gap-x-4 border-default border-b bg-surface px-4 py-3">
      <div className="relative w-full max-w-sm">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Tìm theo tên..."
          className="w-full rounded-lg border-default border bg-app px-3 py-2 text-sm text-default placeholder:text-muted focus:outline-none"
        />
        {searchQuery && searchResults.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border-default border bg-surface shadow-md">
            {searchResults.map((result) => (
              <li key={result.key}>
                <button
                  type="button"
                  onClick={result.onSelect}
                  className="block w-full px-3 py-2 text-left text-sm text-default hover:bg-app"
                >
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ml-auto flex items-center gap-x-3">
        <button type="button" onClick={onLogout} className="text-sm text-muted hover:text-default">
          Đăng xuất
        </button>
        <ThemeSettingsPopover />
      </div>
    </header>
  );
}
