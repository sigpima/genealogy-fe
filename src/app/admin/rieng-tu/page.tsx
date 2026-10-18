'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { PrivacyPanel } from '@/components/admin/PrivacyPanel';

export default function AdminPrivacyPage() {
  return <AdminFrame title="Quyền riêng tư">{() => <PrivacyPanel />}</AdminFrame>;
}
