'use client';

import { Header, type HeaderSearch } from './Header';
import Sidebar, { type NavId } from './Sidebar';
import { useState } from 'react';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { useFamilySite } from '@/components/layout/useFamilyName';
import { canManage, type CurrentUser } from '@/lib/auth/session';

export type AppShellProps = {
  /** Only for pages that are not about a family (the platform console); everywhere else the header shows the family's name. */
  title?: string;
  user: CurrentUser | null;
  active: NavId;
  search?: HeaderSearch;
  onLogout: () => void;
  children: React.ReactNode;
};

/** Sidebar + header chrome shared by the tree page and the admin page. */
export function AppShell({
  title,
  user,
  active,
  search,
  onLogout,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { familyName, treeSlug } = useFamilySite(user);
  return (
    <div className="flex h-screen">
      <Sidebar
        active={active}
        isAdmin={canManage(user)}
        isSuperadmin={user?.role === 'superadmin'}
        signedIn={user !== null}
        myProfile={user?.member ?? null}
        mobileOpen={menuOpen}
        onMobileClose={() => setMenuOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DemoBanner slug={treeSlug} />
        <Header
          familyName={title ?? familyName ?? 'Gia phả'}
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
