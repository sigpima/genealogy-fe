'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { UsersView } from '@/components/admin/UsersView';

export default function AdminUsersPage() {
  return <AdminFrame title="Người dùng">{(user) => <UsersView currentUserId={user.id} />}</AdminFrame>;
}
