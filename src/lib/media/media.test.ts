import { describe, expect, it } from 'vitest';
import { formatSize, imagesOf, mediaErrorMessage, stepIndex, uploadProblem, type MediaItem } from './media';

describe('formatSize', () => {
  it('uses KB below a megabyte and MB with a decimal comma above', () => {
    expect(formatSize(340 * 1024)).toBe('340 KB');
    expect(formatSize(10)).toBe('1 KB');
    expect(formatSize(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });
});

describe('uploadProblem', () => {
  it('accepts images and PDFs within the limit', () => {
    expect(uploadProblem({ name: 'a.jpg', type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(uploadProblem({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toBeNull();
  });
  it('explains what is wrong', () => {
    expect(uploadProblem({ name: 'a.txt', type: 'text/plain', size: 10 })).toMatch(/chỉ nhận/);
    expect(uploadProblem({ name: 'a.png', type: 'image/png', size: 0 })).toMatch(/rỗng/);
    expect(uploadProblem({ name: 'big.png', type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(/quá lớn/);
  });
});

describe('viewer helpers', () => {
  const item = (id: number, kind: MediaItem['kind']): MediaItem => ({
    id, kind, original_name: 'x', content_type: 'x', size: 1, width: null, height: null, caption: null, member_id: 1, place_id: null, url: '', thumb_url: null,
  });
  it('lists only the images', () => {
    expect(imagesOf([item(1, 'image'), item(2, 'document'), item(3, 'image')]).map((m) => m.id)).toEqual([1, 3]);
  });
  it('wraps previous/next', () => {
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(1, 1, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
  it('explains refusals', () => {
    expect(mediaErrorMessage(400, 'not a valid image')).toMatch(/không phải ảnh/);
    expect(mediaErrorMessage(400, 'file too large (max 10 MB)')).toMatch(/quá lớn/);
    expect(mediaErrorMessage(403, 'admin only')).toMatch(/quản trị/);
    expect(mediaErrorMessage(500, null)).toMatch(/thử lại/);
  });
});
