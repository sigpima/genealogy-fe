'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { AdminFrame } from '@/components/admin/AdminFrame';
import { AuditView } from '@/components/audit/AuditView';

export default function AdminAuditPage() {
  const router = useRouter();
  const handleUnauthorized = useCallback(() => router.replace('/'), [router]);
  return <AdminFrame title="Nhật ký">{() => <AuditView embedded onUnauthorized={handleUnauthorized} />}</AdminFrame>;
}
