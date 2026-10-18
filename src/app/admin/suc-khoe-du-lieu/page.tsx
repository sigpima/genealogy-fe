'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { HealthView } from '@/components/admin/HealthView';

export default function AdminHealthPage() {
  return <AdminFrame title="Sức khoẻ dữ liệu">{() => <HealthView />}</AdminFrame>;
}
