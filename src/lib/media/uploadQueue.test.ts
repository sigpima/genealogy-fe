import { describe, expect, it } from 'vitest';
import { runUploads, type UploadState } from './uploadQueue';
import type { MediaItem } from './media';

const file = (name: string, type = 'image/jpeg', size = 100) => ({ name, type, size }) as File;
const made = (name: string) => ({ id: 1, original_name: name }) as MediaItem;

describe('runUploads', () => {
  it('sends the good files, reports the refused one and goes on', async () => {
    const seen: UploadState[] = [];
    const sent: string[] = [];
    const result = await runUploads(
      [file('a.jpg'), file('big.jpg', 'image/jpeg', 11 * 1024 * 1024), file('b.pdf', 'application/pdf')],
      async (f) => {
        sent.push(f.name);
        return made(f.name);
      },
      (s) => seen.push(s),
    );
    expect(sent).toEqual(['a.jpg', 'b.pdf']);
    expect(result).toHaveLength(2);
    const last = seen[seen.length - 1];
    expect(last.done).toBe(2);
    expect(last.total).toBe(3);
    expect(last.failed).toHaveLength(1);
    expect(last.failed[0].name).toBe('big.jpg');
    expect(last.failed[0].reason).toMatch(/quá lớn/);
  });

  it('records a server refusal with its reason and keeps going', async () => {
    const seen: UploadState[] = [];
    await runUploads(
      [file('a.jpg'), file('b.jpg')],
      async (f) => {
        if (f.name === 'a.jpg') throw new Error('File không hợp lệ.');
        return made(f.name);
      },
      (s) => seen.push(s),
    );
    const last = seen[seen.length - 1];
    expect(last.done).toBe(1);
    expect(last.failed).toEqual([{ name: 'a.jpg', reason: 'File không hợp lệ.' }]);
  });

  it('reports nothing done when every file is refused', async () => {
    const seen: UploadState[] = [];
    await runUploads([file('x.exe', 'application/x-msdownload')], async () => made('x'), (s) => seen.push(s));
    expect(seen[seen.length - 1]).toMatchObject({ done: 0, total: 1 });
    expect(seen[seen.length - 1].failed).toHaveLength(1);
  });

  it('reports progress before the first file finishes', async () => {
    const seen: UploadState[] = [];
    await runUploads([file('a.jpg')], async (f) => made(f.name), (s) => seen.push(s));
    expect(seen[0]).toMatchObject({ done: 0, total: 1, failed: [] });
  });
});
