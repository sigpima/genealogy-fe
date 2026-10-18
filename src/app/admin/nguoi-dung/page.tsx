'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { InvitationsPanel } from '@/components/admin/InvitationsPanel';
import { UsersView } from '@/components/admin/UsersView';

export default function AdminUsersPage() {
  return (
    <AdminFrame title="Người dùng">
      {(user) => (
        <div className="space-y-10">
          <UsersView currentUserId={user.id} />
          <InvitationsPanel />
        </div>
      )}
    </AdminFrame>
  );
}
