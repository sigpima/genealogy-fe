import type { MemberDetail } from './types';

export function idsNeedingDetail(detailSet: Set<number>, cache: Map<number, MemberDetail>): number[] {
  return [...detailSet].filter((id) => !cache.has(id));
}
