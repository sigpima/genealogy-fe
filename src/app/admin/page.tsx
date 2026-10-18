'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { AdminHome } from '@/components/admin/AdminHome';

export default function AdminPage() {
  return <AdminFrame>{() => <AdminHome />}</AdminFrame>;
}
