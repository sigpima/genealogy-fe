export const DETAIL_FETCH_CONCURRENCY = 6;

export function pickIdsToFetch(
  candidates: { id: number; x: number; y: number }[],
  center: { x: number; y: number },
  known: { has(id: number): boolean },
  inflight: number,
  limit: number = DETAIL_FETCH_CONCURRENCY
): number[] {
  const budget = limit - inflight;
  if (budget <= 0) return [];
  return candidates
    .filter((candidate) => !known.has(candidate.id))
    .map((candidate) => ({
      id: candidate.id,
      distance: (candidate.x - center.x) ** 2 + (candidate.y - center.y) ** 2,
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, budget)
    .map((candidate) => candidate.id);
}
