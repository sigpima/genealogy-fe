'use client';

import { PlatformFrame } from '@/components/platform/PlatformFrame';
import { SystemView } from '@/components/platform/SystemView';

export default function PlatformSystemPage() {
  return <PlatformFrame title="Hệ thống">{() => <SystemView />}</PlatformFrame>;
}
