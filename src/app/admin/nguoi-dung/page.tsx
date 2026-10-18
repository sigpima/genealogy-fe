'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { UsersPanel } from '@/components/admin/UsersPanel';

export default function AdminUsersPage() {
  return (
    <AdminFrame title="Người dùng">
      {(user) => <UsersPanel currentUserId={user.id} onPendingCount={() => undefined} />}
    </AdminFrame>
  );
}
