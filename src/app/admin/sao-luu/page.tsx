'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { BackupView } from '@/components/admin/BackupView';

export default function AdminBackupPage() {
  return <AdminFrame title="Sao lưu">{() => <BackupView />}</AdminFrame>;
}
