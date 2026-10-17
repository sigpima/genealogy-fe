'use client';

import { useEffect, useMemo, useState } from 'react';
import { assignBranches, type Branch } from '@/lib/branches/branches';
import {
  buildPdf,
  buildTreeSvg,
  countPeople,
  DEFAULT_THEME,
  exportFileName,
  findNode,
  planRaster,
  pruneTree,
  yearsLabel,
  type ExportTheme,
} from '@/lib/export/tree-export';
import type { FamilyMember } from '@/lib/tree/types';

const field =
  'mt-1 w-full min-h-11 rounded-lg border-default border bg-app px-3 text-sm text-default focus:border-[var(--color-primary)] focus:outline-none';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

export type ExportDialogProps = {
  familyTree: FamilyMember;
  branches: Branch[];
  /** The person whose panel is open, offered as "from this person". */
  selected: { id: number; name: string } | null;
  signedIn: boolean;
  onClose: () => void;
};

function readTheme(): ExportTheme {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    background: pick('--color-bg', DEFAULT_THEME.background),
    card: pick('--color-surface', DEFAULT_THEME.card),
    text: pick('--color-text', DEFAULT_THEME.text),
    muted: pick('--color-text-muted', DEFAULT_THEME.muted),
    connector: pick('--color-connector', DEFAULT_THEME.connector),
    border: pick('--color-border', DEFAULT_THEME.border),
    primary: pick('--color-primary', DEFAULT_THEME.primary),
  };
}

/** Birth/death years of everybody, from the paged search API (the tree endpoint carries names only). */
async function fetchYears(): Promise<Map<number, string>> {
  const years = new Map<number, string>();
  for (let offset = 0; offset < 20000; offset += 100) {
    const response = await fetch(`/api/members/search?${new URLSearchParams({ limit: '100', offset: String(offset) })}`, { credentials: 'include' });
    if (!response.ok) break;
    const page = (await response.json()) as { total: number; items: { id: number; birth_year: number | null; death_year: number | null; is_spouse?: boolean }[] };
    for (const item of page.items) {
      if (item.is_spouse) continue;
      const label = yearsLabel(item.birth_year, item.death_year);
      if (label) years.set(item.id, label);
    }
    if (offset + 100 >= page.total) break;
  }
  return years;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function rasterise(svg: string, width: number, height: number, scale: number, type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  const image = new Image();
  image.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('svg'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error('blob');
  return blob;
}

/** "Xuất ảnh": the whole tree, a chi/phái or the descendants of one person as a PNG or a one-page PDF. */
export function ExportDialog({ familyTree, branches, selected, signedIn, onClose }: ExportDialogProps) {
  const [scopeKey, setScopeKey] = useState('all');
  const [generations, setGenerations] = useState('');
  const [withYears, setWithYears] = useState(signedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const scope = useMemo(() => {
    let rootId: number | null = null;
    let label = 'toàn bộ cây';
    if (scopeKey === 'person' && selected) {
      rootId = selected.id;
      label = `con cháu ${selected.name}`;
    } else if (scopeKey.startsWith('branch:')) {
      const branch = branches.find((b) => String(b.id) === scopeKey.slice(7));
      if (branch) {
        rootId = branch.root_member_id;
        label = branch.name;
      }
    }
    const max = Number(generations);
    const maxGenerations = Number.isInteger(max) && max >= 1 ? max : null;
    return { rootId, label, maxGenerations };
  }, [scopeKey, generations, selected, branches]);

  const part = useMemo(() => pruneTree(familyTree, scope), [familyTree, scope]);
  const people = countPeople(part);

  async function run(format: 'png' | 'pdf') {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const years = withYears && signedIn ? await fetchYears() : undefined;
      const byMember = assignBranches(familyTree, branches);
      const head = scope.rootId !== null ? findNode(familyTree, scope.rootId) : null;
      const drawn = buildTreeSvg(part, {
        title: `Gia phả · ${head?.name && scopeKey !== 'all' ? scope.label : familyTree.name}`,
        years,
        branchColor: (id) => byMember.get(id)?.color,
        theme: readTheme(),
        footer: `Xuất ngày ${new Date().toLocaleDateString('vi-VN')} · ${people} người`,
      });
      const plan = planRaster(drawn.width, drawn.height);
      const name = exportFileName(scope.label, format);
      if (format === 'png') {
        download(await rasterise(drawn.svg, drawn.width, drawn.height, plan.scale, 'image/png'), name);
      } else {
        const jpeg = await rasterise(drawn.svg, drawn.width, drawn.height, plan.scale, 'image/jpeg');
        download(new Blob([buildPdf(new Uint8Array(await jpeg.arrayBuffer()), plan.width, plan.height)], { type: 'application/pdf' }), name);
      }
      setDone(plan.reduced ? `Đã tải ${name}. Cây rất lớn nên ảnh bị thu nhỏ — hãy xuất từng chi để rõ hơn.` : `Đã tải ${name}.`);
    } catch {
      setError('Không tạo được ảnh. Cây quá lớn cho trình duyệt — hãy chọn một chi hoặc giới hạn số đời.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Xuất ảnh cây gia phả" onClick={(e) => e.stopPropagation()} className="shadow-float flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-default border bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-default border-b px-5 py-3">
          <h2 className="font-display text-lg font-bold text-default">Xuất ảnh cây</h2>
          <button type="button" className={ghost} onClick={onClose}>
            Đóng ✕
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <label className="block text-sm">
            <span className="text-xs text-muted">Phạm vi</span>
            <select aria-label="Phạm vi xuất" value={scopeKey} onChange={(e) => setScopeKey(e.target.value)} className={field}>
              <option value="all">Toàn bộ cây</option>
              {selected && <option value="person">Con cháu của {selected.name}</option>}
              {branches.map((b) => (
                <option key={b.id} value={`branch:${b.id}`}>
                  {b.name} (đời {b.root_generation}, {b.member_count} người)
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs text-muted">Số đời tối đa (để trống = tất cả)</span>
            <input aria-label="Số đời tối đa" inputMode="numeric" value={generations} onChange={(e) => setGenerations(e.target.value.replace(/\D/g, ''))} className={field} />
          </label>
          {signedIn && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-default">
              <input type="checkbox" checked={withYears} onChange={(e) => setWithYears(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
              Ghi năm sinh – năm mất
            </label>
          )}
          <p className="text-xs text-muted" aria-live="polite">
            {people.toLocaleString('vi-VN')} người sẽ được vẽ.{people > 600 && ' Cây lớn: ảnh sẽ rất rộng, nên xuất theo chi.'}
          </p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {done && (
            <p role="status" className="text-sm text-default">
              {done}
            </p>
          )}
        </div>
        <div className="flex gap-2 border-default border-t px-5 py-3">
          <button type="button" className={primary} disabled={busy} onClick={() => void run('png')}>
            {busy ? 'Đang vẽ…' : 'Tải ảnh PNG'}
          </button>
          <button type="button" className={`${primary} !bg-surface-muted !text-default`} disabled={busy} onClick={() => void run('pdf')}>
            Tải PDF
          </button>
        </div>
      </div>
    </div>
  );
}
