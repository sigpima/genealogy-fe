import type { CSSProperties } from 'react';

// `r` is a valid SVG2 CSS property but missing from React's CSSProperties type.
export function cssRadius(value: string): CSSProperties {
  return { r: value } as CSSProperties;
}
