import { uploadProblem, type MediaItem } from './media';

export type UploadState = { done: number; total: number; failed: { name: string; reason: string }[] };

/**
 * Sends the files one after another. A file the browser can already tell is wrong, or one the server refuses
 * (`upload` throws an Error carrying the reason), is listed in `failed`; the rest still go. Resolves with the stored items.
 */
export async function runUploads(
  files: File[],
  upload: (file: File) => Promise<MediaItem>,
  onProgress: (state: UploadState) => void,
): Promise<MediaItem[]> {
  const state: UploadState = { done: 0, total: files.length, failed: [] };
  const stored: MediaItem[] = [];
  const report = () => onProgress({ done: state.done, total: state.total, failed: [...state.failed] });
  report();
  for (const file of files) {
    const problem = uploadProblem(file);
    if (problem) {
      state.failed.push({ name: file.name, reason: problem });
      report();
      continue;
    }
    try {
      stored.push(await upload(file));
      state.done += 1;
    } catch (error) {
      state.failed.push({ name: file.name, reason: error instanceof Error ? error.message : 'Không thể tải lên.' });
    }
    report();
  }
  return stored;
}
