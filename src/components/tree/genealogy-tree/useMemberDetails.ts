import { useCallback, useEffect, useRef, useState } from 'react';
import type { VisibleChange } from '@/components/tree/TreeCanvas';
import { idsNeedingDetail } from '@/lib/tree/detail-cache';
import { pickIdsToFetch } from '@/lib/tree/detail-queue';
import { EMPTY_API_PROFILE } from '@/lib/tree/types';
import type { MemberDetail } from '@/lib/tree/types';

/**
 * The per-member details (years, spouses, avatar, rank) the cards and the panel show: fetched on demand, nearest the
 * viewport centre first, a few at a time, and cached for the life of the tree.
 */
export function useMemberDetails(detailSet: Set<number>, synthetic: boolean) {
  const [detailsById, setDetailsById] = useState<Map<number, MemberDetail>>(new Map());
  // Tracks in-flight/completed fetch attempts (including failures, cached as a resolved
  // null) so the LOD-driven prefetch effect and a panel click never issue two requests for
  // the same id, and so a failed fetch doesn't silently retry itself.
  const detailFetches = useRef<Map<number, Promise<MemberDetail | null>>>(new Map());
  const failedDetailIds = useRef<Set<number>>(new Set());
  const [, setFailedTick] = useState(0);
  const inflightDetails = useRef(0);
  const lastVisible = useRef<VisibleChange | null>(null);
  const pumpDetailFetches = useRef<() => void>(() => {});
  // Focal-radius members wanted by the LOD set; fetched through the same limiter as visible ones.
  const focalIds = useRef<number[]>([]);

  function ensureMemberDetail(id: number): Promise<MemberDetail | null> {
    const existing = detailFetches.current.get(id);
    if (existing) return existing;
    const promise = fetch(`/api/members/${id}`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<MemberDetail>) : null))
      .then((detail) => {
        if (detail) {
          setDetailsById((prev) => new Map(prev).set(id, detail));
        } else {
          failedDetailIds.current.add(id);
          setFailedTick((tick) => tick + 1);
        }
        return detail;
      })
      .catch(() => {
        failedDetailIds.current.add(id);
        setFailedTick((tick) => tick + 1);
        return null;
      });
    detailFetches.current.set(id, promise);
    return promise;
  }

  function patchMemberDetail(id: number, patch: Partial<Omit<MemberDetail, 'id'>>) {
    setDetailsById((prev) => {
      const next = new Map(prev);
      const existing: MemberDetail = next.get(id) ?? {
        id,
        birth_year: null,
        death_year: null,
        gender: null,
        notes: null,
        avatar_url: null,
        ...EMPTY_API_PROFILE,
        sibling_rank: null,
        spouses: [],
      };
      next.set(id, { ...existing, ...patch });
      return next;
    });
  }

  // Sibling ranks (Trưởng/Thứ/Út) depend on other members, so after an edit that can change them
  // (a year/gender change, adding, deleting or moving a member) re-request details. The old data
  // stays on screen until the fresh response replaces it.
  function refetchDetails(alsoMemberId?: number) {
    detailFetches.current.clear();
    failedDetailIds.current.clear();
    if (alsoMemberId !== undefined) void ensureMemberDetail(alsoMemberId);
    pumpDetailFetches.current();
  }

  /** Forget a failed request so the next ask tries again. */
  function forgetFetch(id: number) {
    detailFetches.current.delete(id);
    failedDetailIds.current.delete(id);
  }

  pumpDetailFetches.current = () => {
    if (synthetic) return;
    const change = lastVisible.current;
    const center = change?.center ?? { x: 0, y: 0 };
    // Focal members sit at the centre (distance 0) so they go first; visible ones follow nearest-first.
    // The dot level never fetches visible members, only the focal set.
    const candidates = [
      ...focalIds.current.map((id) => ({ id, x: center.x, y: center.y })),
      ...(change && change.level !== 'dot' ? change.nodes : []),
    ];
    pickIdsToFetch(candidates, center, detailFetches.current, inflightDetails.current).forEach((id) => {
      inflightDetails.current += 1;
      void ensureMemberDetail(id).finally(() => {
        inflightDetails.current -= 1;
        pumpDetailFetches.current();
      });
    });
  };
  const handleVisibleChange = useCallback((change: VisibleChange) => {
    lastVisible.current = change;
    pumpDetailFetches.current();
  }, []);

  useEffect(() => {
    if (synthetic) return;
    focalIds.current = idsNeedingDetail(detailSet, detailsById);
    pumpDetailFetches.current();
    // detailsById intentionally excluded: the pump skips anything already requested, so this
    // only needs to re-scan when detailSet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSet]);

  return {
    detailsById,
    ensureMemberDetail,
    patchMemberDetail,
    refetchDetails,
    forgetFetch,
    handleVisibleChange,
    hasFailed: (id: number) => failedDetailIds.current.has(id),
  };
}
