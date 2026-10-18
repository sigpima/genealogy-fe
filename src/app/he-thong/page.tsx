'use client';

import { PlatformFrame } from '@/components/platform/PlatformFrame';
import { PlatformHome } from '@/components/platform/PlatformHome';

export default function PlatformPage() {
  return <PlatformFrame>{() => <PlatformHome />}</PlatformFrame>;
}
