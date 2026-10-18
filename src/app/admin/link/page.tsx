'use client';

import { AdminFrame } from '@/components/admin/AdminFrame';
import { SharesView } from '@/components/admin/SharesView';

export default function AdminSharesPage() {
  return <AdminFrame title="Link chia sẻ">{() => <SharesView />}</AdminFrame>;
}
