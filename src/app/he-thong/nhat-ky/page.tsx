'use client';

import { PlatformFrame } from '@/components/platform/PlatformFrame';
import { PlatformLogView } from '@/components/platform/PlatformLogView';

export default function PlatformLogPage() {
  return <PlatformFrame title="Nhật ký nền tảng">{() => <PlatformLogView />}</PlatformFrame>;
}
