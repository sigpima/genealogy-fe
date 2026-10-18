'use client';

import { PlatformFrame } from '@/components/platform/PlatformFrame';
import { TreesPanel } from '@/components/platform/TreesPanel';

export default function PlatformTreesPage() {
  return (
    <PlatformFrame title="Các họ">
      {() => (
        <div className="space-y-2">
          <p className="pb-4 text-base text-muted">
            Mỗi họ có cây, admin và cài đặt riêng. Tạo họ mới kèm admin ở đây; duyệt người dùng và đổi cài đặt của một họ thì bấm “Quản trị” ở họ đó.
          </p>
          <TreesPanel />
        </div>
      )}
    </PlatformFrame>
  );
}
