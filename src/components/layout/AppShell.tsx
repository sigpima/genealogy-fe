'use client';

import { Header, type HeaderSearch } from './Header';
import Sidebar, { type NavId } from './Sidebar';
import { useState } from 'react';
import { canManage, type CurrentUser } from '@/lib/auth/session';

export type AppShellProps = {
  clanName: string;
  user: CurrentUser | null;
  active: NavId;
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
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex h-screen">
      <Sidebar
        active={active}
        isAdmin={canManage(user)}
        isSuperadmin={user?.role === 'superadmin'}
        signedIn={user !== null}
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          clanName={clanName}
          user={user}
          search={search}
          onLogout={onLogout}
          onMenu={() => setMenuOpen(true)}
        />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
