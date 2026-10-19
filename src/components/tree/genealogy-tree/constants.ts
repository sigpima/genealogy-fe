import type { Orientation } from '@/lib/tree/layout';

// Slot sized for the detailed card (240x110): siblings 272px apart = card + 32px gap,
// generations 206px apart = card + 96px gap. Never changes with zoom level.
// (lateral, depth). Turned a quarter (horizontal) the same cards need 240+96 px per generation and 110+26 px per sibling.
export const NODE_SIZE = { x: 272, y: 206 };
export const NODE_SIZE_HORIZONTAL = { x: 136, y: 336 };
export const SEPARATION = { siblings: 1, nonSiblings: 1.25 };
export const INITIAL_ZOOM = 0.9;
export const SCALE_EXTENT = { min: 0.15, max: 2.5 };
export const DETAIL_RADIUS = 3;

export const ORIENTATION_KEY = 'genealogy.tree.orientation';
export type { Orientation };
