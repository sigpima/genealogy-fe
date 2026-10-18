import type { MediaItem } from './media';

/** Photos and documents shown as two labelled groups, each in the order the API gave. */
export function groupMedia(items: MediaItem[]): { photos: MediaItem[]; documents: MediaItem[] } {
  return {
    photos: items.filter((item) => item.kind === 'image'),
    documents: items.filter((item) => item.kind !== 'image'),
  };
}
