export type Transform = { x: number; y: number; k: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };

export function visibleRect(transform: Transform, width: number, height: number, marginMultiplier = 1): Rect {
  const marginX = width * marginMultiplier;
  const marginY = height * marginMultiplier;
  return {
    x0: (-marginX - transform.x) / transform.k,
    y0: (-marginY - transform.y) / transform.k,
    x1: (width + marginX - transform.x) / transform.k,
    y1: (height + marginY - transform.y) / transform.k,
  };
}

export function filterVisibleNodes<T extends { x: number; y: number }>(nodes: T[], rect: Rect): T[] {
  return nodes.filter((n) => n.x >= rect.x0 && n.x <= rect.x1 && n.y >= rect.y0 && n.y <= rect.y1);
}

export function filterVisibleLinks<T extends { source: { x: number; y: number }; target: { x: number; y: number } }>(
  links: T[],
  rect: Rect
): T[] {
  const inRect = (p: { x: number; y: number }) => p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1;
  return links.filter((l) => inRect(l.source) || inRect(l.target));
}
