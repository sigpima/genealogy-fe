import { describe, expect, it } from 'vitest';
import { groupMedia } from './groups';
import type { MediaItem } from './media';

const item = (id: number, kind: 'image' | 'document'): MediaItem => ({
  id, kind, original_name: `f${id}`, content_type: kind === 'image' ? 'image/jpeg' : 'application/pdf', size: 10,
  width: null, height: null, caption: null, member_id: 1, place_id: null, url: `/u/${id}`, thumb_url: null,
});

describe('groupMedia', () => {
  it('splits photos from documents and keeps the order', () => {
    const g = groupMedia([item(3, 'document'), item(1, 'image'), item(2, 'image')]);
    expect(g.photos.map((m) => m.id)).toEqual([1, 2]);
    expect(g.documents.map((m) => m.id)).toEqual([3]);
  });
  it('handles nothing', () => {
    expect(groupMedia([])).toEqual({ photos: [], documents: [] });
  });
});
