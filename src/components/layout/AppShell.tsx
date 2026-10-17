'use client';

import { Header, type HeaderSearch } from './Header';
import Sidebar from './Sidebar';
import { canManage, type CurrentUser } from '@/lib/auth/session';

export type AppShellProps = {
  clanName: string;
  user: CurrentUser | null;
  active: 'tree' | 'search' | 'branches' | 'requests' | 'audit' | 'data' | 'admin' | 'platform';
  search?: HeaderSearch;
  onLogout: () => void;
  children: React.ReactNode;
};

/** Sidebar + header chrome shared by the tree page and the admin page. */
export function AppShell({
  clanName,
  user,
  active,
  search,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen">
      <Sidebar active={active} isAdmin={canManage(user)} isSuperadmin={user?.role === 'superadmin'} signedIn={user !== null} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          clanName={clanName}
          user={user}
          search={search}
          onLogout={onLogout}
        />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
