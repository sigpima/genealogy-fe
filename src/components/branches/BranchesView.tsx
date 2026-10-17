'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BranchForm } from './BranchForm';
import { branchErrorMessage, sortBranches, type Branch } from '@/lib/branches/branches';
import { focusHref } from '@/lib/search/search';
import { barPercents, shareLabel, type Stats } from '@/lib/stats/stats';

const ghost =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-muted hover:text-default focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const danger =
  'min-h-11 whitespace-nowrap rounded-lg px-3 text-sm text-danger hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';
const primary =
  'min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50';

/** The parsed body, or null on any failure; `unauthorized` is called once for a 401 (a private site, not signed in). */
async function getJson<T>(url: string, unauthorized?: () => void): Promise<T | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (response.status === 401) unauthorized?.();
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Figures for the whole family and one card per branch (chi/phái). Admins add, edit and remove branches. */
export function BranchesView({ canManage, onUnauthorized }: { canManage: boolean; onUnauthorized: () => void }) {
  const [overall, setOverall] = useState<Stats | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [perBranch, setPerBranch] = useState<Record<number, Stats>>({});
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  const load = useCallback(async () => {
    const [stats, list] = await Promise.all([
      getJson<Stats>('/api/stats', onUnauthorized),
      getJson<Branch[]>('/api/branches'),
    ]);
    if (!stats || !list) {
      setError('Không tải được dữ liệu. Vui lòng thử lại.');
      return;
    }
    setError(null);
    setOverall(stats);
    setBranches(sortBranches(list));
    const entries = await Promise.all(list.map(async (b) => [b.id, await getJson<Stats>(`/api/stats?branch=${b.id}`)] as const));
    setPerBranch(Object.fromEntries(entries.filter((e): e is readonly [number, Stats] => e[1] !== null)));
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(branch: Branch) {
    if (!window.confirm(`Xoá chi “${branch.name}”? Thành viên vẫn còn nguyên, chỉ mất nhãn chi.`)) return;
    const response = await fetch(`/api/branches/${branch.id}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) {
      setError(branchErrorMessage(response.status, null));
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-default">Chi phái &amp; thống kê</h1>
        <p className="mt-1 text-sm text-muted">
          Một chi là cả nhánh con cháu bắt đầu từ một người (trưởng chi). Người thuộc chi sâu nhất trong số tổ tiên của họ.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {overall && <OverallStats stats={overall} />}

      <section aria-label="Các chi">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-default">Các chi ({branches?.length ?? '…'})</h2>
          {canManage && editing !== 'new' && (
            <button type="button" className={primary} onClick={() => setEditing('new')}>
              Thêm chi
            </button>
          )}
        </div>
        {editing === 'new' && (
          <div className="mt-3 rounded-xl border-default border bg-surface p-4">
            <BranchForm
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await load();
              }}
            />
          </div>
        )}
        {branches && branches.length === 0 && editing !== 'new' && (
          <p className="mt-3 text-sm text-muted">
            Chưa có chi nào.{canManage ? ' Bấm “Thêm chi” rồi chọn người đứng đầu chi.' : ''}
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {(branches ?? []).map((branch) => (
            <li key={branch.id} className="rounded-xl border-default border bg-surface p-4">
              {editing === branch.id ? (
                <BranchForm
                  branch={branch}
                  onCancel={() => setEditing(null)}
                  onSaved={async () => {
                    setEditing(null);
                    await load();
                  }}
                />
              ) : (
                <BranchCard
                  branch={branch}
                  stats={perBranch[branch.id]}
                  canManage={canManage}
                  onEdit={() => setEditing(branch.id)}
                  onDelete={() => void remove(branch)}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BranchCard({
  branch,
  stats,
  canManage,
  onEdit,
  onDelete,
}: {
  branch: Branch;
  stats: Stats | undefined;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const generations = stats?.by_generation ?? [];
  const from = generations[0]?.generation;
  const to = generations[generations.length - 1]?.generation;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display flex items-center gap-x-2 text-base font-bold text-default">
            <span aria-hidden="true" className="inline-block size-3.5 rounded-full" style={{ backgroundColor: branch.color }} />
            {branch.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Trưởng chi: <b className="font-semibold text-default">{branch.root_name}</b> (đời {branch.root_generation}) ·{' '}
            {branch.member_count} người
            {from !== undefined && to !== undefined && ` · đời ${from}–${to}`}
          </p>
          {branch.description && <p className="mt-2 whitespace-pre-wrap text-sm text-default">{branch.description}</p>}
          {stats && (
            <p className="mt-2 text-xs text-muted">
              Nam {stats.gender.male} · Nữ {stats.gender.female} · Còn sống {stats.status.living} · Đã mất {stats.status.deceased}
              {stats.spouses > 0 && ` · ${stats.spouses} vợ/chồng`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center">
          <Link href={focusHref(branch.root_member_id)} className={`${ghost} flex items-center`}>
            Xem trên cây
          </Link>
          {canManage && (
            <>
              <button type="button" className={ghost} onClick={onEdit}>
                Sửa
              </button>
              <button type="button" className={danger} onClick={onDelete}>
                Xoá
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function OverallStats({ stats }: { stats: Stats }) {
  const percents = barPercents(stats.by_generation.map((g) => g.count));
  const known = stats.gender.male + stats.gender.female + stats.gender.other;
  return (
    <section aria-label="Thống kê chung" className="rounded-xl border-default border bg-surface p-4">
      <h2 className="text-sm font-semibold text-default">
        {stats.total} người trong dòng họ{stats.spouses > 0 && ` · ${stats.spouses} vợ/chồng`} · {stats.by_generation.length} đời
      </h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Theo đời</h3>
          <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pe-1">
            {stats.by_generation.map((g, i) => (
              <li key={g.generation} className="flex items-center gap-x-2 text-xs text-default">
                <span className="w-12 shrink-0 text-muted">Đời {g.generation}</span>
                <span className="h-3 flex-1 overflow-hidden rounded bg-surface-muted">
                  <span className="block h-full rounded bg-primary" style={{ width: `${percents[i]}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums">{g.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5 text-sm text-default">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Giới tính</h3>
            <p className="mt-2">
              Nam {stats.gender.male} ({shareLabel(stats.gender.male, stats.total)}) · Nữ {stats.gender.female} (
              {shareLabel(stats.gender.female, stats.total)})
              {stats.gender.other > 0 && ` · Khác ${stats.gender.other}`}
              {stats.gender.unknown > 0 && ` · Chưa rõ ${stats.gender.unknown}`}
            </p>
            {known < stats.total && (
              <p className="mt-1 text-xs text-muted">
                {stats.gender.unknown} người chưa có giới tính — bổ sung ở trang Nhập liệu để số liệu chính xác hơn.
              </p>
            )}
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tình trạng</h3>
            <p className="mt-2">
              Còn sống {stats.status.living} · Đã mất {stats.status.deceased} · Chưa rõ {stats.status.unknown}
            </p>
          </div>
          {stats.by_branch.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Theo chi</h3>
              <ul className="mt-2 space-y-1">
                {stats.by_branch.map((b) => (
                  <li key={b.id} className="flex items-center gap-x-2">
                    <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    {b.name}: {b.count}
                  </li>
                ))}
                {stats.without_branch > 0 && <li className="text-muted">Chưa thuộc chi nào: {stats.without_branch}</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
