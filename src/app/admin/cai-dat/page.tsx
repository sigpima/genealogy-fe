'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { SettingsPanel } from '@/components/admin/SettingsPanel';

export default function AdminSettingsPage() {
  return <AdminFrame title="Cài đặt họ">{() => <SettingsPanel />}</AdminFrame>;
}
